// Party Mode server actions against the real Firestore emulator: host-only
// administration, round state machine, join codes, anonymous guests,
// ballots (digital + paper), duplicate and concurrent submissions, reveal,
// recap, recovery, display sessions and guest-to-account claims.
// Uses its own uids (pm-*) — test files share one emulator.
// Run via `npm run test:functions` at the repo root (emulators:exec).
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { partyAction } = require("../index.js");

const db = admin.firestore();
let seq = 0;

function account(uid) {
  return { uid, token: { firebase: { sign_in_provider: "google.com" } } };
}
function anon(uid) {
  return { uid, token: { firebase: { sign_in_provider: "anonymous" } } };
}
function call(auth, action, data = {}, ip) {
  return partyAction.run({ auth, data: { action, ...data }, rawRequest: { ip: ip || `10.0.${seq % 250}.${(seq++ % 250) + 1}` } });
}

const bottle = (name, extra = {}) => ({ bottle: { name, source: "manual", ...extra } });

// Only this file's own counters: other test files share the emulator.
async function clearRateLimits() {
  const snap = await db.collection("rateLimits").get();
  await Promise.all(snap.docs.filter((d) => d.id.startsWith("pm-") || d.id.startsWith("ip-")).map((d) => d.ref.delete()));
}

let n = 0;
function ids() {
  n += 1;
  return { host: account(`pm-host-${n}`), other: account(`pm-other-${n}`), g1: anon(`pm-g1-${n}`), g2: anon(`pm-g2-${n}`) };
}

async function setupParty(host, { samples = 3, categories = 1, settings } = {}) {
  const { partyId, joinCode } = await call(host, "createParty", {
    details: { name: "Bourbon Night" },
    settings,
    categories: Array.from({ length: categories }, (_, i) => ({ name: `Round ${i + 1}`, libraryId: i === 0 ? "double-oaked" : null })),
  });
  const party = (await db.doc(`parties/${partyId}`).get()).data();
  for (const category of party.categories) {
    await call(host, "setSamples", {
      partyId,
      categoryId: category.id,
      assignment: "random",
      samples: Array.from({ length: samples }, (_, i) => bottle(`Bottle ${category.name} ${i + 1}`, { price: 20 + i })),
    });
  }
  const fresh = (await db.doc(`parties/${partyId}`).get()).data();
  return { partyId, joinCode, party: fresh, categoryId: fresh.categories[0].id };
}

beforeEach(async () => {
  await clearRateLimits();
});

describe("party administration", () => {
  it("rejects unauthenticated, anonymous and non-host administration", async () => {
    const { host, other, g1 } = ids();
    await expect(partyAction.run({ data: { action: "createParty" } })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(call(g1, "createParty", { details: { name: "x" } })).rejects.toMatchObject({ code: "permission-denied" });
    const { partyId, categoryId } = await setupParty(host);
    await expect(call(other, "setCategoryState", { partyId, categoryId, to: "voting_open" })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(other, "updateParty", { partyId, details: { name: "Hijacked" } })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(other, "deleteParty", { partyId, confirm: true })).rejects.toMatchObject({ code: "permission-denied" });
    // Host impersonation: an anonymous identity with the host's uid string is still not the host.
    await expect(call(anon(host.uid), "setCategoryState", { partyId, categoryId, to: "voting_open" })).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(call(host, "bogusAction", { partyId })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("keeps bottle identities out of the party doc and in the host-only secrets doc", async () => {
    const { host } = ids();
    const { partyId, party } = await setupParty(host);
    expect(JSON.stringify(party)).not.toContain("Bottle Round");
    const secrets = (await db.doc(`partySecrets/${partyId}`).get()).data();
    expect(secrets.hostUid).toBe(host.uid);
    expect(secrets.categories[party.categories[0].id].samples).toHaveLength(3);
    expect(party.categories[0].sampleLabels).toEqual(["A", "B", "C"]);
  });

  it("supports many categories, duplicates, reorder, rename and removal before voting", async () => {
    const { host } = ids();
    const { partyId, party } = await setupParty(host, { categories: 5, samples: 2 });
    const [c1, c2, c3, c4, c5] = party.categories;
    const result = await call(host, "setCategories", {
      partyId,
      categories: [
        { id: c3.id, name: c3.name },
        { id: c1.id, name: "Renamed" },
        { id: c2.id, name: c2.name },
        { id: c4.id, name: c4.name },
        { name: "Round 1 again", duplicateOf: c1.id },
        { name: "Head-to-Head", libraryId: "head-to-head", description: "Two bottles" },
      ],
    });
    expect(result.categories.map((c) => c.name)).toEqual(["Round 3", "Renamed", "Round 2", "Round 4", "Round 1 again", "Head-to-Head"]);
    expect(result.categories.find((c) => c.id === c5.id)).toBeUndefined();
    const secrets = (await db.doc(`partySecrets/${partyId}`).get()).data();
    expect(secrets.categories[c5.id]).toBeUndefined();
    const dup = result.categories[4];
    expect(dup.sampleLabels).toEqual(["A", "B"]);
    expect(secrets.categories[dup.id].samples.map((s) => s.bottle.name).sort()).toEqual(
      secrets.categories[c1.id].samples.map((s) => s.bottle.name).sort(),
    );
  });

  it("enforces category and sample limits and the minimum two bottles to open voting", async () => {
    const { host } = ids();
    const { partyId, party } = await setupParty(host, { samples: 0 });
    const categoryId = party.categories[0].id;
    await expect(call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" })).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(
      call(host, "setSamples", { partyId, categoryId, assignment: "random", samples: Array.from({ length: 13 }, (_, i) => bottle(`B${i}`)) }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      call(host, "setCategories", { partyId, categories: Array.from({ length: 25 }, (_, i) => ({ name: `C${i}` })) }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    // Two-bottle head-to-head is fine.
    await call(host, "setSamples", { partyId, categoryId, assignment: "random", samples: [bottle("X"), bottle("Y")] });
    await expect(call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" })).resolves.toMatchObject({ state: "voting_open" });
  });

  it("accepts manual sample assignment only as an exact permutation", async () => {
    const { host } = ids();
    const { partyId, categoryId } = await setupParty(host, { samples: 0 });
    await expect(
      call(host, "setSamples", { partyId, categoryId, assignment: "manual", samples: [{ ...bottle("X"), label: "A" }, { ...bottle("Y"), label: "A" }] }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    const { samples } = await call(host, "setSamples", {
      partyId,
      categoryId,
      assignment: "manual",
      samples: [{ ...bottle("X"), label: "B" }, { ...bottle("Y"), label: "A" }],
    });
    expect(samples.map((s) => [s.label, s.bottle.name])).toEqual([["A", "Y"], ["B", "X"]]);
  });

  it("runs the round state machine and locks bottles once voting begins", async () => {
    const { host } = ids();
    const { partyId, categoryId } = await setupParty(host);
    await call(host, "setCategoryState", { partyId, categoryId, to: "ready" });
    await expect(call(host, "setCategoryState", { partyId, categoryId, to: "revealed" })).rejects.toMatchObject({ code: "failed-precondition" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    const party = (await db.doc(`parties/${partyId}`).get()).data();
    expect(party.status).toBe("live");
    expect(party.categories[0].lockedAt).toBeTypeOf("number");
    await expect(call(host, "setSamples", { partyId, categoryId, assignment: "random", samples: [bottle("X"), bottle("Y")] })).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await expect(call(host, "setCategories", { partyId, categories: [] })).rejects.toMatchObject({ code: "failed-precondition" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_closed" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_closed" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "revealed" });
    await expect(call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" })).rejects.toMatchObject({ code: "failed-precondition" });
    const audit = await db.collection(`parties/${partyId}/audit`).where("type", "==", "round-state").get();
    expect(audit.size).toBe(6);
  });
});

describe("guest access", () => {
  it("previews without an account and joins anonymously with a nickname", async () => {
    const { host, g1 } = ids();
    const { partyId, joinCode } = await setupParty(host);
    const preview = await partyAction.run({ data: { action: "previewParty", code: joinCode.toLowerCase() }, rawRequest: { ip: "10.9.9.9" } });
    expect(preview).toMatchObject({ partyId, name: "Bourbon Night", joinBlocker: null, guest: null });
    expect(JSON.stringify(preview)).not.toContain("Bottle");
    const joined = await call(g1, "joinParty", { code: joinCode, nickname: "  Kev <script> " });
    expect(joined).toMatchObject({ partyId, nickname: "Kev script", alreadyJoined: false });
    expect(joined.recoveryCode).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    // Joining again from the same identity never creates a duplicate participant.
    await expect(call(g1, "joinParty", { code: joinCode, nickname: "Someone Else" })).resolves.toMatchObject({ alreadyJoined: true });
    const party = (await db.doc(`parties/${partyId}`).get()).data();
    expect(party.counts.guests).toBe(1);
  });

  it("rejects invalid codes, duplicate nicknames, closed or expired invitations and full parties", async () => {
    const { host, g1, g2 } = ids();
    const { partyId, joinCode } = await setupParty(host);
    await expect(call(g1, "joinParty", { code: "ZZZZZZ", nickname: "A" })).rejects.toMatchObject({ code: "not-found" });
    await expect(call(g1, "joinParty", { code: "!!", nickname: "A" })).rejects.toMatchObject({ code: "invalid-argument" });
    await call(g1, "joinParty", { code: joinCode, nickname: "Sam" });
    await expect(call(g2, "joinParty", { code: joinCode, nickname: "sam" })).rejects.toMatchObject({ code: "already-exists" });

    await call(host, "setInvite", { partyId, active: false });
    await expect(call(g2, "joinParty", { code: joinCode, nickname: "Pat" })).rejects.toMatchObject({ code: "failed-precondition" });
    await call(host, "setInvite", { partyId, active: true, expiresAt: Date.now() - 1000 });
    await expect(call(g2, "joinParty", { code: joinCode, nickname: "Pat" })).rejects.toMatchObject({ code: "failed-precondition" });
    await call(host, "setInvite", { partyId, active: true, expiresAt: null });
    await call(host, "updateParty", { partyId, details: { name: "Bourbon Night", capacity: 1 } });
    await expect(call(g2, "joinParty", { code: joinCode, nickname: "Pat" })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rotating the join code invalidates the old one", async () => {
    const { host, g1 } = ids();
    const { joinCode, partyId } = await setupParty(host);
    const { joinCode: next } = await call(host, "rotateJoinCode", { partyId });
    expect(next).not.toBe(joinCode);
    await expect(call(g1, "joinParty", { code: joinCode, nickname: "A" })).rejects.toMatchObject({ code: "not-found" });
    await expect(call(g1, "joinParty", { code: next, nickname: "A" })).resolves.toMatchObject({ partyId });
  });

  it("rate limits repeated join attempts per identity and per IP", async () => {
    const { g1, g2 } = ids();
    await expect(call(g1, "joinParty", { code: "QQQQQQ", nickname: "A" })).rejects.toMatchObject({ code: "not-found" });
    // Seed the counter at the cap rather than looping, so other test files
    // clearing rateLimits in parallel can't race this.
    await db.doc(`rateLimits/${g1.uid}_party_join`).set({ count: 20, windowStart: Date.now() });
    await expect(call(g1, "joinParty", { code: "QQQQQQ", nickname: "A" })).rejects.toMatchObject({ code: "resource-exhausted" });
    // A fresh anonymous identity from the same flooding IP is still capped.
    const ip = "10.250.250.250";
    const crypto = require("crypto");
    const ipKey = `ip-${crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32)}_party_joinIp`;
    await db.doc(`rateLimits/${ipKey}`).set({ count: 120, windowStart: Date.now() });
    await expect(call(g2, "joinParty", { code: "QQQQQQ", nickname: "A" }, ip)).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("recovers a guest on a new device only with the recovery code, moving ballot ownership", async () => {
    const { host, g1, g2 } = ids();
    const { partyId, joinCode, categoryId } = await setupParty(host);
    const { recoveryCode } = await call(g1, "joinParty", { code: joinCode, nickname: "Lee" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    const { ballotId } = await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 7 } } });

    await expect(call(g2, "recoverGuest", { code: joinCode, recoveryCode: "AAAAA-AAAAA" })).rejects.toMatchObject({ code: "permission-denied" });
    const recovered = await call(g2, "recoverGuest", { code: joinCode, recoveryCode });
    expect(recovered).toMatchObject({ recovered: true, nickname: "Lee" });
    expect(recovered.recoveryCode).not.toBe(recoveryCode);
    expect((await db.doc(`parties/${partyId}/ballots/${ballotId}`).get()).data().ownerUid).toBe(g2.uid);
    expect((await db.doc(`parties/${partyId}/guests/${g1.uid}`).get()).exists).toBe(false);
    // The old code was single-use.
    await expect(call(anon("pm-thief"), "recoverGuest", { code: joinCode, recoveryCode })).rejects.toMatchObject({ code: "permission-denied" });
    // The recovered identity keeps editing the same ballot (no duplicate).
    await call(g2, "saveBallot", { partyId, categoryId, scores: { B: { overall: 5 } } });
    const ballots = await db.collection(`parties/${partyId}/ballots`).where("categoryId", "==", categoryId).get();
    expect(ballots.size).toBe(1);
  });

  it("removing a guest revokes access and stops their ballots counting", async () => {
    const { host, g1 } = ids();
    const { partyId, joinCode, categoryId } = await setupParty(host);
    await call(g1, "joinParty", { code: joinCode, nickname: "Troll" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    const { ballotId } = await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 0 } } });
    await call(host, "removeGuest", { partyId, guestUid: g1.uid });
    expect((await db.doc(`parties/${partyId}/ballots/${ballotId}`).get()).data().excluded).toBe(true);
    await expect(call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 1 } } })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(g1, "joinParty", { code: joinCode, nickname: "Troll2" })).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("ballots", () => {
  it("accepts digital scores only while voting is open and only for this round's samples", async () => {
    const { host, g1, other } = ids();
    const { partyId, joinCode, categoryId, party } = await setupParty(host, { categories: 2 });
    await call(g1, "joinParty", { code: joinCode, nickname: "Ana" });
    await expect(call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 7 } } })).rejects.toMatchObject({ code: "failed-precondition" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await expect(call(g1, "saveBallot", { partyId, categoryId, scores: { Z: { overall: 7 } } })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 11 } } })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(call(g1, "saveBallot", { partyId, categoryId: party.categories[1].id, scores: { A: { overall: 7 } } })).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await expect(call(other, "saveBallot", { partyId, categoryId, scores: { A: { overall: 7 } } })).rejects.toMatchObject({ code: "permission-denied" });
    await call(g1, "saveBallot", { partyId, categoryId, mode: "detailed", scores: { A: { overall: 7, nose: 8, notes: "Cherry" } }, favoriteLabel: "A" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_closed" });
    await expect(call(g1, "saveBallot", { partyId, categoryId, scores: { B: { overall: 7 } } })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("keeps one ballot per guest per round under concurrent submissions", async () => {
    const { host, g1 } = ids();
    const { partyId, joinCode, categoryId } = await setupParty(host);
    await call(g1, "joinParty", { code: joinCode, nickname: "Rae" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await Promise.all([
      call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 6 } } }),
      call(g1, "saveBallot", { partyId, categoryId, scores: { B: { overall: 7 } } }),
      call(g1, "saveBallot", { partyId, categoryId, scores: { C: { overall: 8 } } }),
    ]);
    const ballots = await db.collection(`parties/${partyId}/ballots`).where("categoryId", "==", categoryId).get();
    expect(ballots.size).toBe(1);
    expect(Object.keys(ballots.docs[0].data().scores).sort()).toEqual(["A", "B", "C"]);
    const party = (await db.doc(`parties/${partyId}`).get()).data();
    expect(party.counts.digital[categoryId]).toBe(1);
  });

  it("locks submitted scores when the host disallows edits, but lets guests add new samples", async () => {
    const { host, g1 } = ids();
    const { partyId, joinCode, categoryId } = await setupParty(host, { settings: { allowEdits: false } });
    await call(g1, "joinParty", { code: joinCode, nickname: "Jo" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 6 } }, favoriteLabel: "A" });
    const result = await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 10 }, B: { overall: 4 } }, favoriteLabel: "B" });
    expect(result.scores).toEqual({ A: { overall: 6 }, B: { overall: 4 } });
    expect(result.favoriteLabel).toBe("A");
  });

  it("lets only the host enter, edit and delete paper ballots, with an audit trail", async () => {
    const { host, g1 } = ids();
    const { partyId, joinCode, categoryId } = await setupParty(host);
    await call(g1, "joinParty", { code: joinCode, nickname: "Dee" });
    await expect(call(host, "savePaperBallot", { partyId, categoryId, ballotNumber: "1", scores: { A: { overall: 5 } } })).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await expect(call(g1, "savePaperBallot", { partyId, categoryId, ballotNumber: "1", scores: { A: { overall: 5 } } })).rejects.toMatchObject({
      code: "permission-denied",
    });
    const { ballotId } = await call(host, "savePaperBallot", { partyId, categoryId, ballotNumber: "1", scores: { A: { overall: 5 } }, favoriteLabel: "A" });
    await expect(call(host, "savePaperBallot", { partyId, categoryId, ballotNumber: "1", scores: { B: { overall: 5 } } })).rejects.toMatchObject({
      code: "already-exists",
    });
    await call(host, "savePaperBallot", { partyId, categoryId, ballotId, ballotNumber: "1", scores: { A: { overall: 6 } } });
    const edited = (await db.doc(`parties/${partyId}/ballots/${ballotId}`).get()).data();
    expect(edited).toMatchObject({ revision: 2, source: "paper", scores: { A: { overall: 6 } } });

    // A paper ballot under a digital guest's nickname is flagged as a possible duplicate.
    await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 9 } } });
    const dup = await call(host, "savePaperBallot", { partyId, categoryId, nickname: "dee", scores: { A: { overall: 9 } } });
    expect(dup.possibleDuplicateOf).toMatchObject({ nickname: "Dee" });
    await call(host, "setBallotExcluded", { partyId, ballotId: dup.ballotId, excluded: true, reason: "Duplicate of Dee" });

    const { ballots } = await call(host, "listBallots", { partyId, categoryId });
    const digital = ballots.find((b) => b.source === "digital");
    expect(digital.scores).toBeUndefined();
    expect(ballots.filter((b) => b.excluded)).toHaveLength(1);

    await expect(call(host, "deletePaperBallot", { partyId, ballotId })).rejects.toMatchObject({ code: "invalid-argument" });
    await call(host, "deletePaperBallot", { partyId, ballotId, confirm: true });
    const party = (await db.doc(`parties/${partyId}`).get()).data();
    expect(party.counts.paper[categoryId]).toBe(0);
    const audit = await db.collection(`parties/${partyId}/audit`).get();
    const types = audit.docs.map((d) => d.data().type);
    expect(types).toEqual(expect.arrayContaining(["paper-ballot-entered", "paper-ballot-edited", "ballot-excluded", "paper-ballot-deleted"]));
  });
});

describe("reveal, recap and displays", () => {
  it("reveals results only on host authorization, combining digital and paper ballots", async () => {
    const { host, g1, g2 } = ids();
    const { partyId, joinCode, categoryId } = await setupParty(host);
    await call(g1, "joinParty", { code: joinCode, nickname: "Max" });
    await call(g2, "joinParty", { code: joinCode, nickname: "Ivy" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 8 }, B: { overall: 6 } }, favoriteLabel: "B" });
    await call(g2, "saveBallot", { partyId, categoryId, scores: { A: { overall: 6 }, B: { overall: 6 } }, favoriteLabel: "B" });
    await call(host, "savePaperBallot", { partyId, categoryId, ballotNumber: "3", scores: { A: { overall: 10 } } });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_closed" });
    expect((await db.doc(`parties/${partyId}/results/${categoryId}`).get()).exists).toBe(false);
    await call(host, "setCategoryState", { partyId, categoryId, to: "revealed" });
    const results = (await db.doc(`parties/${partyId}/results/${categoryId}`).get()).data();
    const a = results.samples.find((s) => s.label === "A");
    expect(a).toMatchObject({ average: 8, count: 3, rank: 1 });
    expect(a.bottle.name).toMatch(/^Bottle Round 1/);
    expect(results.samples.find((s) => s.label === "C")).toMatchObject({ average: null, count: 0 });
    expect(results.peoplesChoice).toEqual(["B"]);
    expect(results.ballotsCounted).toBe(3);
  });

  it("builds the recap from revealed rounds only", async () => {
    const { host, g1 } = ids();
    const { partyId, joinCode, party } = await setupParty(host, { categories: 2 });
    const [c1, c2] = party.categories;
    await call(g1, "joinParty", { code: joinCode, nickname: "Bo" });
    for (const c of [c1, c2]) {
      await call(host, "setCategoryState", { partyId, categoryId: c.id, to: "voting_open" });
      await call(g1, "saveBallot", { partyId, categoryId: c.id, scores: { A: { overall: 7 } } });
      await call(host, "setCategoryState", { partyId, categoryId: c.id, to: "voting_closed" });
    }
    await call(host, "setCategoryState", { partyId, categoryId: c1.id, to: "revealed" });
    await call(host, "completeParty", { partyId, notes: "Thanks all" });
    const recap = (await db.doc(`parties/${partyId}/results/recap`).get()).data();
    expect(recap.categories.map((c) => c.categoryId)).toEqual([c1.id]);
    expect(JSON.stringify(recap)).not.toContain("Bottle Round 2");
    expect(recap.notes).toBe("Thanks all");
    expect((await db.doc(`parties/${partyId}/results/${c2.id}`).get()).exists).toBe(false);
    await expect(call(g1, "saveBallot", { partyId, categoryId: c1.id, scores: { A: { overall: 7 } } })).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("reveal-all reveals every closed round at once", async () => {
    const { host } = ids();
    const { partyId, party } = await setupParty(host, { categories: 2, settings: { revealByCategory: false } });
    for (const c of party.categories) {
      await call(host, "setCategoryState", { partyId, categoryId: c.id, to: "voting_open" });
      await call(host, "setCategoryState", { partyId, categoryId: c.id, to: "voting_closed" });
    }
    const { revealed } = await call(host, "revealAll", { partyId });
    expect(revealed).toHaveLength(2);
  });

  it("issues read-only display sessions from a host token, and rejects stale tokens", async () => {
    const { host, other } = ids();
    const { partyId } = await setupParty(host);
    await expect(call(other, "createDisplayLink", { partyId })).rejects.toMatchObject({ code: "permission-denied" });
    const { token } = await call(host, "createDisplayLink", { partyId });
    const tv = anon("pm-tv-" + n);
    await expect(call(tv, "redeemDisplay", { partyId, token: "nope" })).rejects.toMatchObject({ code: "permission-denied" });
    await call(tv, "redeemDisplay", { partyId, token });
    expect((await db.doc(`parties/${partyId}/displays/${tv.uid}`).get()).exists).toBe(true);
    await call(host, "revokeDisplays", { partyId });
    expect((await db.doc(`parties/${partyId}/displays/${tv.uid}`).get()).exists).toBe(false);
    await expect(call(tv, "redeemDisplay", { partyId, token })).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("host participation (I'm tasting too)", () => {
  it("is on by default: the host scores through one guest record, without a QR join or a second account", async () => {
    const { host, g1 } = ids();
    const { partyId, joinCode, categoryId } = await setupParty(host);
    const party = (await db.doc(`parties/${partyId}`).get()).data();
    expect(party.hostTasting).toBe(true);
    expect(party.counts.guests).toBe(0);
    const hostGuest = (await db.doc(`parties/${partyId}/guests/${host.uid}`).get()).data();
    expect(hostGuest).toMatchObject({ uid: host.uid, isHost: true, revoked: false, nickname: "Your host" });
    // Scanning their own QR code never makes a second participant.
    await expect(call(host, "joinParty", { code: joinCode, nickname: "Host again" })).rejects.toMatchObject({ code: "failed-precondition" });

    await call(g1, "joinParty", { code: joinCode, nickname: "Max" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await call(host, "saveBallot", { partyId, categoryId, scores: { A: { overall: 9 }, B: { overall: 5 } }, favoriteLabel: "A" });
    // Editable while voting is open, still one ballot.
    await call(host, "saveBallot", { partyId, categoryId, scores: { A: { overall: 7 } } });
    await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 5 }, B: { overall: 9 } }, favoriteLabel: "B" });
    const ballots = await db.collection(`parties/${partyId}/ballots`).where("participantKey", "==", hostGuest.participantKey).get();
    expect(ballots.size).toBe(1);
    expect(ballots.docs[0].data()).toMatchObject({ ownerUid: host.uid, source: "digital", scores: { A: { overall: 7 }, B: { overall: 5 } } });
    expect((await db.doc(`parties/${partyId}`).get()).data().counts.digital[categoryId]).toBe(2);

    // Same deadline as everyone: closed means closed for the host too.
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_closed" });
    await expect(call(host, "saveBallot", { partyId, categoryId, scores: { C: { overall: 8 } } })).rejects.toMatchObject({ code: "failed-precondition" });

    // Equal weight: A = (7 + 5) / 2, B = (5 + 9) / 2, both ballots counted once.
    await call(host, "setCategoryState", { partyId, categoryId, to: "revealed" });
    const results = (await db.doc(`parties/${partyId}/results/${categoryId}`).get()).data();
    expect(results.samples.find((x) => x.label === "A")).toMatchObject({ average: 6, count: 2 });
    expect(results.samples.find((x) => x.label === "B")).toMatchObject({ average: 7, count: 2 });
    expect(results.ballotsCounted).toBe(2);
  });

  it("can be turned off at creation, and turned on later from the dashboard", async () => {
    const { host } = ids();
    const { partyId } = await call(host, "createParty", { details: { name: "Hosting only" }, hostTasting: false, categories: [{ name: "R1" }] });
    expect((await db.doc(`parties/${partyId}`).get()).data().hostTasting).toBe(false);
    expect((await db.doc(`parties/${partyId}/guests/${host.uid}`).get()).exists).toBe(false);
    await call(host, "setHostTasting", { partyId, enabled: true });
    expect((await db.doc(`parties/${partyId}/guests/${host.uid}`).get()).data()).toMatchObject({ isHost: true, revoked: false });
    expect((await db.doc(`parties/${partyId}`).get()).data().hostTasting).toBe(true);
  });

  it("turning it off stops the host's unrevealed ballots counting; turning it back on restores them, never duplicating", async () => {
    const { host } = ids();
    const { partyId, categoryId } = await setupParty(host);
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    const { ballotId } = await call(host, "saveBallot", { partyId, categoryId, scores: { A: { overall: 8 } } });

    await call(host, "setHostTasting", { partyId, enabled: false });
    expect((await db.doc(`parties/${partyId}/ballots/${ballotId}`).get()).data()).toMatchObject({ excluded: true });
    expect((await db.doc(`parties/${partyId}`).get()).data().counts.digital[categoryId]).toBe(0);
    await expect(call(host, "saveBallot", { partyId, categoryId, scores: { B: { overall: 8 } } })).rejects.toMatchObject({ code: "permission-denied" });
    // Still the host: management keeps working.
    await expect(call(host, "setCategoryState", { partyId, categoryId, to: "voting_closed" })).resolves.toBeTruthy();
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });

    await call(host, "setHostTasting", { partyId, enabled: true });
    expect((await db.doc(`parties/${partyId}/ballots/${ballotId}`).get()).data()).toMatchObject({ excluded: false });
    expect((await db.doc(`parties/${partyId}`).get()).data().counts.digital[categoryId]).toBe(1);
    await call(host, "saveBallot", { partyId, categoryId, scores: { B: { overall: 6 } } });
    const all = await db.collection(`parties/${partyId}/ballots`).where("categoryId", "==", categoryId).get();
    expect(all.size).toBe(1);
  });

  it("keeps a guest-excluded ballot excluded when the host turns tasting back on", async () => {
    const { host } = ids();
    const { partyId, categoryId } = await setupParty(host);
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    const { ballotId } = await call(host, "saveBallot", { partyId, categoryId, scores: { A: { overall: 8 } } });
    await call(host, "setBallotExcluded", { partyId, ballotId, excluded: true, reason: "Duplicate" });
    await call(host, "setHostTasting", { partyId, enabled: false });
    await call(host, "setHostTasting", { partyId, enabled: true });
    expect((await db.doc(`parties/${partyId}/ballots/${ballotId}`).get()).data()).toMatchObject({ excluded: true, excludedReason: "Duplicate" });
  });

  it("can't be removed like a guest, toggled by anyone else, or doubled up with a paper ballot in the host's name", async () => {
    const { host, other } = ids();
    const { partyId, categoryId } = await setupParty(host);
    await expect(call(host, "removeGuest", { partyId, guestUid: host.uid })).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(call(other, "setHostTasting", { partyId, enabled: false })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(anon(host.uid), "setHostTasting", { partyId, enabled: false })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(host, "setHostTasting", { partyId, enabled: "yes" })).rejects.toMatchObject({ code: "invalid-argument" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await expect(call(host, "savePaperBallot", { partyId, categoryId, nickname: "your HOST", scores: { A: { overall: 9 } } })).rejects.toMatchObject({
      code: "failed-precondition",
    });
    // Other paper ballots are unaffected.
    await expect(call(host, "savePaperBallot", { partyId, categoryId, nickname: "Grandpa", scores: { A: { overall: 9 } } })).resolves.toBeTruthy();
  });
});

describe("guest-to-account claims", () => {
  it("moves a guest's party records to their new account with a single-use token", async () => {
    const { host, g1, g2, other } = ids();
    const { partyId, joinCode, categoryId } = await setupParty(host);
    await call(g1, "joinParty", { code: joinCode, nickname: "Cy" });
    await call(g2, "joinParty", { code: joinCode, nickname: "Di" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    const { ballotId } = await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 7 } } });

    await expect(call(other, "createClaimToken")).rejects.toMatchObject({ code: "failed-precondition" });
    const { token } = await call(g1, "createClaimToken");
    await expect(call(g2, "claimGuest", { token })).rejects.toMatchObject({ code: "permission-denied" });
    const { claimed } = await call(other, "claimGuest", { token });
    expect(claimed).toEqual([partyId]);
    expect((await db.doc(`parties/${partyId}/guests/${other.uid}`).get()).data()).toMatchObject({ nickname: "Cy", isAccount: true });
    expect((await db.doc(`parties/${partyId}/ballots/${ballotId}`).get()).data().ownerUid).toBe(other.uid);
    // g2's records are untouched, and the token can't be replayed.
    expect((await db.doc(`parties/${partyId}/guests/${g2.uid}`).get()).exists).toBe(true);
    await expect(call(account("pm-replay"), "claimGuest", { token })).rejects.toMatchObject({ code: "permission-denied" });
  });
});
