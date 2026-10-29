// Dual Experience Mode (guided + blind groups in one party) against the
// Firestore emulator: the guided projection, group assignment and its
// restrictions, group-stamped ballots, independent group results, and the
// blind-integrity rules for tasters who move groups.
// Uses its own uids (du-*): test files share one emulator.
// Run via `npm run test:functions` at the repo root (emulators:exec).
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { partyAction } = require("../index.js");

const db = admin.firestore();
let n = 0;
let seq = 0;

const account = (uid) => ({ uid, token: { firebase: { sign_in_provider: "google.com" } } });
const anon = (uid) => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });
const call = (auth, action, data = {}) =>
  partyAction.run({ auth, data: { action, ...data }, rawRequest: { ip: `10.88.${seq % 250}.${(seq++ % 250) + 1}` } });

const WHEATED = [
  { bottle: { name: "Castle & Key Wheated", distillery: "Castle & Key", proof: 100, price: 45, bottleId: "b1", source: "my-bar" } },
  { bottle: { name: "Weller Antique 107", distillery: "Buffalo Trace", proof: 107, age: "NAS" } },
  { bottle: { name: "Redwood Empire Wheated", proof: 90 } },
];

async function data(path) {
  return (await db.doc(path).get()).data();
}

async function rosterOf(partyId) {
  return (await db.collection(`parties/${partyId}/roster`).get()).docs.map((d) => d.data());
}

async function setup({ hostGroup, hostTasting = true, joinGroup } = {}) {
  n += 1;
  const host = account(`du-host-${n}`);
  const created = await call(host, "createParty", {
    details: { name: "Dual Night" },
    hostName: "Kevin",
    format: "dual",
    hostTasting,
    ...(hostGroup ? { hostGroup } : {}),
    ...(joinGroup ? { dual: { joinGroup, plannedGuided: 7, plannedBlind: 3 } } : { dual: { plannedGuided: 7, plannedBlind: 3 } }),
    settings: { revealByCategory: false },
    categories: [{ name: "Rye" }, { name: "Wheated" }, { name: "Double Oaked" }],
  });
  const { partyId, joinCode } = created;
  const categoryIds = created.categories.map((c) => c.id);
  for (const categoryId of categoryIds) {
    await call(host, "setSamples", { partyId, categoryId, assignment: "random", samples: WHEATED });
  }
  return { host, partyId, joinCode, categoryIds };
}

async function joinGuests(joinCode, names) {
  const out = [];
  for (const name of names) {
    const auth = anon(`du-g-${n}-${name.replace(/\W/g, "")}`);
    await call(auth, "joinParty", { code: joinCode, nickname: name });
    out.push(auth);
  }
  return out;
}

async function keyOf(partyId, auth) {
  return (await data(`parties/${partyId}/guests/${auth.uid}`)).participantKey;
}

beforeEach(async () => {
  const snap = await db.collection("rateLimits").get();
  await Promise.all(snap.docs.filter((d) => d.id.startsWith("du-") || d.id.startsWith("ip-")).map((d) => d.ref.delete()));
});

describe("dual experience: setup and the guided projection", () => {
  it("keeps every bottle off the guest-readable party doc and writes a guided view without private fields", async () => {
    const { partyId, categoryIds } = await setup();
    const party = await data(`parties/${partyId}`);
    expect(party.format).toBe("dual");
    expect(party.dual).toMatchObject({ joinGroup: "blind", plannedGuided: 7, plannedBlind: 3 });
    expect(party.settings.revealByCategory).toBe(false);
    const json = JSON.stringify(party);
    for (const s of WHEATED) expect(json).not.toContain(s.bottle.name);
    for (const c of party.categories) expect(c.bottles).toBeUndefined();

    const guided = await data(`parties/${partyId}/guided/${categoryIds[1]}`);
    const names = Object.values(guided.bottles).map((b) => b.name).sort();
    expect(names).toEqual(WHEATED.map((s) => s.bottle.name).sort());
    // What the guided group sees: never the host's price or My Bar link.
    expect(JSON.stringify(guided)).not.toContain("45");
    expect(JSON.stringify(guided)).not.toContain("bottleId");
    expect(JSON.stringify(guided)).not.toContain("my-bar");
    expect(Object.keys(guided.bottles).sort()).toEqual(["A", "B", "C"]);
  });

  it("puts the tasting host in the guided group by default, and lets them choose blind", async () => {
    const guidedHost = await setup();
    expect((await data(`parties/${guidedHost.partyId}/guests/${guidedHost.host.uid}`)).group).toBe("guided");
    expect((await rosterOf(guidedHost.partyId)).find((e) => e.role === "host")).toMatchObject({ group: "guided", tasting: true });
    const blindHost = await setup({ hostGroup: "blind" });
    expect((await data(`parties/${blindHost.partyId}/guests/${blindHost.host.uid}`)).group).toBe("blind");
  });

  it("switching an event to dual writes guided views and explicit groups; switching away removes the views", async () => {
    n += 1;
    const host = account(`du-host-${n}`);
    const { partyId, joinCode, categories } = await call(host, "createParty", { details: { name: "Was Blind" }, hostName: "Kevin", categories: [{ name: "Rye" }] });
    const categoryId = categories[0].id;
    await call(host, "setSamples", { partyId, categoryId, assignment: "random", samples: WHEATED });
    const [sam] = await joinGuests(joinCode, ["Sam"]);
    expect((await db.doc(`parties/${partyId}/guided/${categoryId}`).get()).exists).toBe(false);

    await call(host, "updateParty", { partyId, format: "dual", dual: { joinGroup: "blind" } });
    expect((await db.doc(`parties/${partyId}/guided/${categoryId}`).get()).exists).toBe(true);
    expect((await data(`parties/${partyId}/guests/${sam.uid}`)).group).toBe("blind");
    expect((await data(`parties/${partyId}/guests/${host.uid}`)).group).toBe("guided");
    expect((await rosterOf(partyId)).find((e) => e.name === "Sam").group).toBe("blind");

    await call(host, "updateParty", { partyId, format: "regular" });
    expect((await db.doc(`parties/${partyId}/guided/${categoryId}`).get()).exists).toBe(false);
  });

  it("removes a removed round's guided view", async () => {
    const { host, partyId, categoryIds } = await setup();
    const party = await data(`parties/${partyId}`);
    await call(host, "setCategories", { partyId, categories: party.categories.slice(0, 2).map((c) => ({ id: c.id, name: c.name })) });
    expect((await db.doc(`parties/${partyId}/guided/${categoryIds[2]}`).get()).exists).toBe(false);
    expect((await db.doc(`parties/${partyId}/guided/${categoryIds[0]}`).get()).exists).toBe(true);
  });
});

describe("dual experience: groups", () => {
  it("runs a 10-person event: 7 guided (host included) and 3 blind, from one join code", async () => {
    const { host, partyId, joinCode } = await setup();
    const names = ["Matt", "Ana", "Bo", "Cy", "Di", "Ed", "Richy", "Fay", "Gus"];
    const guests = await joinGuests(joinCode, names);
    // New guests start blind (the safe default) until the host moves them.
    for (const g of guests) expect((await data(`parties/${partyId}/guests/${g.uid}`)).group).toBe("blind");
    for (const g of guests.slice(0, 6)) {
      await expect(call(host, "assignGroup", { partyId, participantKey: await keyOf(partyId, g), group: "guided" })).resolves.toMatchObject({ ok: true, group: "guided" });
    }
    const roster = await rosterOf(partyId);
    const tasting = roster.filter((e) => e.tasting);
    expect(tasting).toHaveLength(10);
    expect(tasting.filter((e) => e.group === "guided")).toHaveLength(7);
    expect(tasting.filter((e) => e.group === "blind").map((e) => e.name).sort()).toEqual(["Fay", "Gus", "Richy"]);
    // The shared roster stays safe: no uids anywhere.
    const json = JSON.stringify(roster);
    for (const g of [host, ...guests]) expect(json).not.toContain(g.uid);
  });

  it("starts new guests in the guided group when the host chose that", async () => {
    const { partyId, joinCode } = await setup({ joinGroup: "guided" });
    const [sam] = await joinGuests(joinCode, ["Sam"]);
    expect((await data(`parties/${partyId}/guests/${sam.uid}`)).group).toBe("guided");
  });

  it("lets admins assign groups, never guests; only the host moves themselves", async () => {
    const { host, partyId, joinCode } = await setup();
    const [sam, ana] = await joinGuests(joinCode, ["Sam", "Ana"]);
    const cohost = account(`du-co-${n}`);
    const { token } = await call(host, "createCoHostInvite", { partyId });
    await call(cohost, "acceptCoHost", { partyId, token, name: "Pat" });
    const samKey = await keyOf(partyId, sam);
    await expect(call(sam, "assignGroup", { partyId, participantKey: samKey, group: "guided" })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(ana, "assignGroup", { partyId, participantKey: samKey, group: "guided" })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(cohost, "assignGroup", { partyId, participantKey: samKey, group: "guided" })).resolves.toMatchObject({ ok: true });
    await expect(call(cohost, "assignGroup", { partyId, participantKey: "host", group: "blind" })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(host, "assignGroup", { partyId, participantKey: "host", group: "blind" })).resolves.toMatchObject({ ok: true, group: "blind" });
    await expect(call(host, "assignGroup", { partyId, participantKey: samKey, group: "nope" })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("requires confirmation once a taster has scored, moves their scores with them, and flags guided-to-blind as not fully blind", async () => {
    const { host, partyId, joinCode, categoryIds } = await setup({ joinGroup: "guided" });
    const [sam] = await joinGuests(joinCode, ["Sam"]);
    const samKey = await keyOf(partyId, sam);
    await call(host, "setCategoryState", { partyId, categoryId: categoryIds[0], to: "voting_open" });
    await call(sam, "saveBallot", { partyId, categoryId: categoryIds[0], scores: { A: { overall: 8 } } });
    expect((await data(`parties/${partyId}/ballots/${categoryIds[0]}__${samKey}`)).group).toBe("guided");

    const unconfirmed = await call(host, "assignGroup", { partyId, participantKey: samKey, group: "blind" });
    expect(unconfirmed).toMatchObject({ ok: false, needsConfirm: true, scoredRounds: 1 });
    expect((await data(`parties/${partyId}/guests/${sam.uid}`)).group).toBe("guided");

    await expect(call(host, "assignGroup", { partyId, participantKey: samKey, group: "blind", confirm: true })).resolves.toMatchObject({ ok: true, movedBallots: 1 });
    const moved = await data(`parties/${partyId}/ballots/${categoryIds[0]}__${samKey}`);
    expect(moved).toMatchObject({ group: "blind", unblinded: true, scores: { A: { overall: 8 } } });
    // They saw every unrevealed round's bottles: later blind ballots are flagged too.
    await call(host, "setCategoryState", { partyId, categoryId: categoryIds[1], to: "voting_open" });
    await call(sam, "saveBallot", { partyId, categoryId: categoryIds[1], scores: { B: { overall: 6 } } });
    expect(await data(`parties/${partyId}/ballots/${categoryIds[1]}__${samKey}`)).toMatchObject({ group: "blind", unblinded: true });
    const log = (await db.collection(`parties/${partyId}/audit`).where("type", "==", "group-changed").get()).docs.map((d) => d.data());
    expect(log[0]).toMatchObject({ from: "guided", to: "blind", movedBallots: 1 });

    // Moving back to guided clears the flag (guided ballots aren't blind at all).
    await call(host, "assignGroup", { partyId, participantKey: samKey, group: "guided", confirm: true });
    expect((await data(`parties/${partyId}/ballots/${categoryIds[0]}__${samKey}`)).unblinded).toBeUndefined();
  });

  it("refuses groups outside dual events", async () => {
    n += 1;
    const host = account(`du-host-${n}`);
    const { partyId } = await call(host, "createParty", { details: { name: "Plain" }, hostName: "K", categories: [{ name: "Rye" }] });
    await expect(call(host, "assignGroup", { partyId, participantKey: "host", group: "blind" })).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(call(host, "updateParty", { partyId, dual: { joinGroup: "guided" } })).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("dual experience: simultaneous rounds and independent results", () => {
  it("scores both groups in the same round, counts every ballot equally within its group, and compares by average", async () => {
    const { host, partyId, joinCode, categoryIds } = await setup();
    const guests = await joinGuests(joinCode, ["Matt", "Ana", "Richy", "Fay"]);
    for (const g of guests.slice(0, 2)) await call(host, "assignGroup", { partyId, participantKey: await keyOf(partyId, g), group: "guided" });
    const [rye] = categoryIds;
    await call(host, "setCategoryState", { partyId, categoryId: rye, to: "voting_open" });
    // Guided: host (guided) + Matt + Ana. Blind: Richy + Fay + one paper ballot.
    await call(host, "saveBallot", { partyId, categoryId: rye, scores: { A: { overall: 9 }, B: { overall: 7 }, C: { overall: 5 } }, favoriteLabel: "A" });
    await call(guests[0], "saveBallot", { partyId, categoryId: rye, scores: { A: { overall: 8 }, B: { overall: 7 }, C: { overall: 6 } }, favoriteLabel: "A" });
    await call(guests[1], "saveBallot", { partyId, categoryId: rye, scores: { A: { overall: 7 }, B: { overall: 7 } }, favoriteLabel: "B" });
    await call(guests[2], "saveBallot", { partyId, categoryId: rye, scores: { A: { overall: 5 }, B: { overall: 8 }, C: { overall: 7 } }, favoriteLabel: "B" });
    await call(guests[3], "saveBallot", { partyId, categoryId: rye, scores: { A: { overall: 6 }, B: { overall: 9 }, C: { overall: 7 } }, favoriteLabel: "B" });
    await expect(call(host, "savePaperBallot", { partyId, categoryId: rye, ballotNumber: "12", scores: { A: { overall: 4 } } })).rejects.toMatchObject({ code: "invalid-argument" });
    await call(host, "savePaperBallot", { partyId, categoryId: rye, ballotNumber: "12", group: "blind", scores: { A: { overall: 4 }, B: { overall: 7 } }, favoriteLabel: "B" });
    const listed = await call(host, "listBallots", { partyId, categoryId: rye });
    expect(listed.ballots.find((b) => b.source === "paper").group).toBe("blind");

    // Per-group progress for the dashboard comes from the public roster.
    const roster = await rosterOf(partyId);
    expect(roster.filter((e) => e.group === "guided" && e.progress[rye] === "submitted")).toHaveLength(2);
    expect(roster.filter((e) => e.group === "blind" && e.progress[rye] === "submitted")).toHaveLength(2);

    // One shared state machine: no result is written before the reveal.
    await call(host, "setCategoryState", { partyId, categoryId: rye, to: "voting_closed" });
    expect((await db.doc(`parties/${partyId}/results/${rye}`).get()).exists).toBe(false);
    await call(host, "revealAll", { partyId });
    const results = await data(`parties/${partyId}/results/${rye}`);
    const guided = results.groups.guided;
    const blind = results.groups.blind;
    expect(guided.ballotsCounted).toBe(3);
    expect(blind.ballotsCounted).toBe(3);
    const avg = (group, label) => group.samples.find((s) => s.label === label);
    expect(avg(guided, "A")).toMatchObject({ average: 8, count: 3, favoriteVotes: 2 });
    // A missing rating is left out of the average, never counted as zero.
    expect(avg(guided, "C")).toMatchObject({ average: 5.5, count: 2 });
    expect(avg(blind, "B")).toMatchObject({ average: 8, count: 3, favoriteVotes: 3 });
    expect(avg(blind, "A")).toMatchObject({ average: 5, count: 3 });
    expect(guided.champions).toEqual(["A"]);
    expect(blind.champions).toEqual(["B"]);
    const cmpA = results.comparison.samples.find((s) => s.label === "A");
    expect(cmpA).toMatchObject({ guided: { average: 8, count: 3 }, blind: { average: 5, count: 3 }, difference: 3 });
    expect(results.comparison.largestDifference).toEqual(["A"]);
    expect(results.comparison.bothEnjoyed).toEqual(["B"]);
    expect(results.comparison.sameWinner).toBe(false);
    expect(results.guestScores.find((g) => g.name === "Richy").group).toBe("blind");
    expect(results.guestScores.find((g) => g.name === "Kevin").group).toBe("guided");
  });

  it("only unblinds a host who tastes blind when they view the bottle key", async () => {
    const guidedHost = await setup();
    await call(guidedHost.host, "setCategoryState", { partyId: guidedHost.partyId, categoryId: guidedHost.categoryIds[0], to: "voting_open" });
    await call(guidedHost.host, "saveBallot", { partyId: guidedHost.partyId, categoryId: guidedHost.categoryIds[0], scores: { A: { overall: 7 } } });
    const viewed = await call(guidedHost.host, "getBottleKey", { partyId: guidedHost.partyId, confirm: true });
    expect(viewed.flaggedCategoryIds).toEqual([]);
    const hostKey = await keyOf(guidedHost.partyId, guidedHost.host);
    expect((await data(`parties/${guidedHost.partyId}/ballots/${guidedHost.categoryIds[0]}__${hostKey}`)).unblinded).toBeUndefined();

    // A host tasting blind who set up the bottles is not fully blind, as in a blind party.
    const blindHost = await setup({ hostGroup: "blind" });
    await call(blindHost.host, "setCategoryState", { partyId: blindHost.partyId, categoryId: blindHost.categoryIds[0], to: "voting_open" });
    await call(blindHost.host, "saveBallot", { partyId: blindHost.partyId, categoryId: blindHost.categoryIds[0], scores: { A: { overall: 7 } } });
    const blindKey = await keyOf(blindHost.partyId, blindHost.host);
    expect(await data(`parties/${blindHost.partyId}/ballots/${blindHost.categoryIds[0]}__${blindKey}`)).toMatchObject({ group: "blind", unblinded: true });
  });
});

describe("dual experience: stations and pairings", () => {
  it("stores optional stations and per-round pairings, only for this party's rounds", async () => {
    const { host, partyId, categoryIds, joinCode } = await setup();
    const extras = {
      stations: [
        { name: "Oak", description: "Toasted oak staves.", guidance: "Smell first, then nose the Rye." },
        { name: "Vanilla bean" },
      ],
      pairings: { [categoryIds[0]]: { name: "York Peppermint Patties", note: "After your first sip." } },
    };
    await call(host, "updateParty", { partyId, extras });
    const party = await data(`parties/${partyId}`);
    expect(party.extras.stations.map((s) => s.name)).toEqual(["Oak", "Vanilla bean"]);
    expect(party.extras.stations[0].id).toMatch(/^st_/);
    expect(party.extras.pairings[categoryIds[0]]).toEqual({ name: "York Peppermint Patties", note: "After your first sip." });
    await expect(call(host, "updateParty", { partyId, extras: { pairings: { c_nope: { name: "Candy" } } } })).rejects.toMatchObject({ code: "invalid-argument" });
    const [sam] = await joinGuests(joinCode, ["Sam"]);
    await expect(call(sam, "updateParty", { partyId, extras })).rejects.toMatchObject({ code: "permission-denied" });
    // Removing a round drops its pairing.
    await call(host, "setCategories", { partyId, categories: party.categories.slice(1).map((c) => ({ id: c.id, name: c.name })) });
    expect((await data(`parties/${partyId}`)).extras.pairings).toEqual({});
  });
});
