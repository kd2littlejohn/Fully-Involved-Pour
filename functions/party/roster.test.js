// "Who's Tasting" roster (roster.js) against the Firestore emulator: kept in
// step with joins, removals, host tasting and co-hosts; status from real
// ballots; no uids, emails or scores; backfill for older parties.
// Uses its own uids (rs-*): test files share one emulator.
// Run via `npm run test:functions` at the repo root (emulators:exec).
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { partyAction } = require("../index.js");
const { coHostRosterId } = require("./roster.js");

const db = admin.firestore();
let n = 0;
let seq = 0;

const account = (uid) => ({ uid, token: { firebase: { sign_in_provider: "google.com" } } });
const anon = (uid) => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });
const call = (auth, action, data = {}) =>
  partyAction.run({ auth, data: { action, ...data }, rawRequest: { ip: `10.66.${seq % 250}.${(seq++ % 250) + 1}` } });

async function roster(partyId) {
  const snap = await db.collection(`parties/${partyId}/roster`).get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
}

// Host tasting is on by default; tests that need a hosting-only host say so.
async function setup({ hostTasting = false } = {}) {
  n += 1;
  const host = account(`rs-host-${n}`);
  const g1 = anon(`rs-g1-${n}`);
  const g2 = anon(`rs-g2-${n}`);
  const { partyId, joinCode, categories } = await call(host, "createParty", {
    details: { name: "Roster Night" },
    hostName: "Kevin",
    hostTasting,
    categories: [{ name: "Wheated" }],
  });
  const categoryId = categories[0].id;
  await call(host, "setSamples", {
    partyId,
    categoryId,
    assignment: "random",
    samples: [{ bottle: { name: "Weller" } }, { bottle: { name: "Larceny" } }],
  });
  return { host, g1, g2, partyId, joinCode, categoryId };
}

beforeEach(async () => {
  const snap = await db.collection("rateLimits").get();
  await Promise.all(snap.docs.filter((d) => d.id.startsWith("rs-") || d.id.startsWith("ip-")).map((d) => d.ref.delete()));
});

describe("Who's Tasting roster", () => {
  it("lists the host from the start, and each guest as they join", async () => {
    const { g1, g2, partyId, joinCode } = await setup();
    expect(await roster(partyId)).toEqual({
      host: expect.objectContaining({ id: "host", name: "Kevin", role: "host", tasting: false }),
    });
    await call(g1, "joinParty", { code: joinCode, nickname: "Richy" });
    await call(g2, "joinParty", { code: joinCode, nickname: "Sam" });
    const entries = Object.values(await roster(partyId));
    expect(entries.filter((e) => e.role === "guest").map((e) => e.name).sort()).toEqual(["Richy", "Sam"]);
    expect(entries.filter((e) => e.tasting)).toHaveLength(2);
  });

  it("counts a host who tastes from creation (the default)", async () => {
    const { partyId } = await setup({ hostTasting: true });
    expect((await roster(partyId)).host).toMatchObject({ role: "host", tasting: true });
  });

  it("never stores uids, emails, scores or notes", async () => {
    const { host, g1, partyId, joinCode, categoryId } = await setup();
    await call(g1, "joinParty", { code: joinCode, nickname: "Richy" });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await call(g1, "saveBallot", { partyId, categoryId, mode: "detailed", scores: { A: { overall: 7.5, notes: "secret cherry note" } } });
    const json = JSON.stringify(await roster(partyId));
    expect(json).not.toContain(g1.uid);
    expect(json).not.toContain(host.uid);
    expect(json).not.toContain("secret cherry note");
    expect(json).not.toContain("7.5");
    for (const entry of Object.values(await roster(partyId))) {
      expect(Object.keys(entry).sort()).toEqual(["id", "joinedAt", "name", "progress", "role", "tasting"]);
    }
  });

  it("shows Tasting then Submitted from the guest's real ballot", async () => {
    const { host, g1, partyId, joinCode, categoryId } = await setup();
    const { nickname } = await call(g1, "joinParty", { code: joinCode, nickname: "Richy" });
    const id = Object.values(await roster(partyId)).find((e) => e.name === nickname).id;
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 7 } } });
    expect((await roster(partyId))[id].progress).toEqual({ [categoryId]: "tasting" });
    await call(g1, "saveBallot", { partyId, categoryId, scores: { B: { overall: 6 } } });
    expect((await roster(partyId))[id].progress).toEqual({ [categoryId]: "submitted" });
  });

  it("counts the host only while they're tasting, and keeps their status", async () => {
    const { host, partyId, categoryId } = await setup();
    await call(host, "setHostTasting", { partyId, enabled: true });
    expect((await roster(partyId)).host).toMatchObject({ role: "host", tasting: true });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await call(host, "saveBallot", { partyId, categoryId, scores: { A: { overall: 8 } } });
    await call(host, "setHostTasting", { partyId, enabled: false });
    expect((await roster(partyId)).host).toMatchObject({ tasting: false, progress: { [categoryId]: "tasting" } });
    await call(host, "setHostTasting", { partyId, enabled: true });
    expect((await roster(partyId)).host).toMatchObject({ tasting: true, progress: { [categoryId]: "tasting" } });
    expect(Object.keys(await roster(partyId))).toEqual(["host"]);
  });

  it("drops a removed guest", async () => {
    const { host, g1, g2, partyId, joinCode } = await setup();
    await call(g1, "joinParty", { code: joinCode, nickname: "Troll" });
    await call(g2, "joinParty", { code: joinCode, nickname: "Sam" });
    await call(host, "removeGuest", { partyId, guestUid: g1.uid });
    const names = Object.values(await roster(partyId)).map((e) => e.name).sort();
    expect(names).toEqual(["Kevin", "Sam"]);
  });

  it("lists co-hosts as non-tasting, under a one-way id, and removes them", async () => {
    const { host, partyId } = await setup();
    const cohost = account(`rs-co-${n}`);
    const { token } = await call(host, "createCoHostInvite", { partyId });
    await call(cohost, "acceptCoHost", { partyId, token, name: "Pat" });
    const id = coHostRosterId(partyId, cohost.uid);
    expect(id).not.toContain(cohost.uid);
    expect((await roster(partyId))[id]).toMatchObject({ name: "Pat", role: "cohost", tasting: false });
    await call(host, "removeCoHost", { partyId, uid: cohost.uid });
    expect((await roster(partyId))[id]).toBeUndefined();
  });

  it("keeps one entry per guest through recovery on a new device", async () => {
    const { g1, g2, partyId, joinCode } = await setup();
    const { recoveryCode } = await call(g1, "joinParty", { code: joinCode, nickname: "Lee" });
    await call(g2, "recoverGuest", { code: joinCode, recoveryCode });
    const guests = Object.values(await roster(partyId)).filter((e) => e.role === "guest");
    expect(guests.map((e) => e.name)).toEqual(["Lee"]);
  });

  it("backfills a party created before the roster existed (admins only)", async () => {
    const { host, g1, g2, partyId, joinCode, categoryId } = await setup();
    await call(g1, "joinParty", { code: joinCode, nickname: "Richy" });
    await call(g2, "joinParty", { code: joinCode, nickname: "Gone" });
    await call(host, "removeGuest", { partyId, guestUid: g2.uid });
    await call(host, "setHostTasting", { partyId, enabled: true });
    await call(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
    await call(g1, "saveBallot", { partyId, categoryId, scores: { A: { overall: 7 }, B: { overall: 6 } } });
    const before = await roster(partyId);
    const snap = await db.collection(`parties/${partyId}/roster`).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    await expect(call(g1, "syncRoster", { partyId })).rejects.toMatchObject({ code: "permission-denied" });
    const { count } = await call(host, "syncRoster", { partyId });
    expect(count).toBe(2);
    expect(await roster(partyId)).toEqual(before);
  });
});
