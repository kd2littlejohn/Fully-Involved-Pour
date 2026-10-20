// Admin identities (admins.js) against the Firestore emulator: no host or
// co-host uid on the guest-readable party document, authorization from the
// protected admin records, and automatic migration of older parties.
// Uses its own uids (ad-*): test files share one emulator.
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
  partyAction.run({ auth, data: { action, ...data }, rawRequest: { ip: `10.77.${seq % 250}.${(seq++ % 250) + 1}` } });

async function partyDoc(partyId) {
  return (await db.doc(`parties/${partyId}`).get()).data();
}

async function setup() {
  n += 1;
  const host = account(`ad-host-${n}`);
  const cohost = account(`ad-co-${n}`);
  const guest = anon(`ad-g-${n}`);
  const { partyId, joinCode, categories } = await call(host, "createParty", {
    details: { name: "Private Night" },
    hostName: "Kevin",
    categories: [{ name: "Rye" }],
  });
  const categoryId = categories[0].id;
  await call(host, "setSamples", { partyId, categoryId, assignment: "random", samples: [{ bottle: { name: "Pikesville" } }, { bottle: { name: "Rittenhouse" } }] });
  return { host, cohost, guest, partyId, joinCode, categoryId };
}

// A party as older code stored it: admin uids on the party document.
async function makeLegacy(partyId, hostUid, coHostUid) {
  const admins = await db.collection(`parties/${partyId}/admins`).get();
  await Promise.all(admins.docs.map((d) => d.ref.delete()));
  await db.doc(`parties/${partyId}`).update({
    hostUid,
    coHostUids: coHostUid ? [coHostUid] : [],
    coHosts: coHostUid ? { [coHostUid]: { name: "Pat", addedAt: 5 } } : {},
  });
}

beforeEach(async () => {
  const snap = await db.collection("rateLimits").get();
  await Promise.all(snap.docs.filter((d) => d.id.startsWith("ad-") || d.id.startsWith("ip-")).map((d) => d.ref.delete()));
});

describe("admin identities", () => {
  it("never puts host or co-host uids on the party document", async () => {
    const { host, cohost, partyId } = await setup();
    const { token } = await call(host, "createCoHostInvite", { partyId });
    await call(cohost, "acceptCoHost", { partyId, token, name: "Pat" });
    const json = JSON.stringify(await partyDoc(partyId));
    expect(json).not.toContain(host.uid);
    expect(json).not.toContain(cohost.uid);
    expect(await partyDoc(partyId)).toMatchObject({ hostName: "Kevin" });
    const records = (await db.collection(`parties/${partyId}/admins`).get()).docs.map((d) => d.data());
    expect(records.map((r) => [r.uid, r.role]).sort()).toEqual([[cohost.uid, "cohost"], [host.uid, "host"]].sort());
  });

  it("authorizes from the protected records: host, co-host, and nobody else", async () => {
    const { host, cohost, guest, partyId, joinCode, categoryId } = await setup();
    const { token } = await call(host, "createCoHostInvite", { partyId });
    await call(cohost, "acceptCoHost", { partyId, token, name: "Pat" });
    await call(guest, "joinParty", { code: joinCode, nickname: "Sam" });
    await expect(call(cohost, "setCategoryState", { partyId, categoryId, to: "voting_open" })).resolves.toMatchObject({ state: "voting_open" });
    await expect(call(guest, "setCategoryState", { partyId, categoryId, to: "voting_closed" })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(call(guest, "getBottleKey", { partyId, confirm: true })).rejects.toMatchObject({ code: "permission-denied" });
    // An anonymous identity claiming the host's uid is still not the host.
    await expect(call(anon(host.uid), "getBottleKey", { partyId, confirm: true })).rejects.toMatchObject({ code: "permission-denied" });
    await call(guest, "saveBallot", { partyId, categoryId, scores: { A: { overall: 7 } } });
    await call(host, "removeCoHost", { partyId, uid: cohost.uid });
    expect((await db.doc(`parties/${partyId}/admins/${cohost.uid}`).get()).exists).toBe(false);
    await expect(call(cohost, "setCategoryState", { partyId, categoryId, to: "voting_closed" })).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("keeps host participation working", async () => {
    const { host, partyId, categoryId } = await setup();
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await expect(call(host, "saveBallot", { partyId, categoryId, scores: { A: { overall: 8 } } })).resolves.toBeTruthy();
    const { ballots } = await call(host, "listBallots", { partyId, categoryId });
    expect(ballots).toHaveLength(1);
  });

  it("migrates an older party on its first action, keeping the same admins", async () => {
    const { host, cohost, guest, partyId, joinCode, categoryId } = await setup();
    await makeLegacy(partyId, host.uid, cohost.uid);
    // A guest joining by code is enough to trigger it.
    await call(guest, "joinParty", { code: joinCode, nickname: "Sam" });
    const after = await partyDoc(partyId);
    expect(after.hostUid).toBeUndefined();
    expect(after.coHostUids).toBeUndefined();
    expect(after.coHosts).toBeUndefined();
    expect((await db.doc(`parties/${partyId}/admins/${host.uid}`).get()).data()).toMatchObject({ role: "host", name: "Kevin" });
    expect((await db.doc(`parties/${partyId}/admins/${cohost.uid}`).get()).data()).toMatchObject({ role: "cohost", name: "Pat", addedAt: 5 });
    await expect(call(cohost, "setCategoryState", { partyId, categoryId, to: "voting_open" })).resolves.toBeTruthy();
    await expect(call(host, "getBottleKey", { partyId, confirm: true })).resolves.toBeTruthy();
  });

  it("migrates through any party action, and is idempotent", async () => {
    const { host, partyId } = await setup();
    await makeLegacy(partyId, host.uid, null);
    await call(host, "migrateParty", { partyId });
    await call(host, "migrateParty", { partyId });
    expect((await partyDoc(partyId)).hostUid).toBeUndefined();
    const records = await db.collection(`parties/${partyId}/admins`).get();
    expect(records.docs.map((d) => d.data().role)).toEqual(["host"]);
  });

  it("returns no admin uid to a guest previewing or joining", async () => {
    const { host, guest, joinCode } = await setup();
    const preview = await call(guest, "previewParty", { code: joinCode });
    const joined = await call(guest, "joinParty", { code: joinCode, nickname: "Sam" });
    expect(JSON.stringify([preview, joined])).not.toContain(host.uid);
    expect(preview).toMatchObject({ hostName: "Kevin", isHost: false });
    expect((await call(host, "previewParty", { code: joinCode })).isHost).toBe(true);
  });
});
