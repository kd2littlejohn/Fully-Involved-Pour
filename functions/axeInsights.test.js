// AXE Insights event processing against the real Firestore emulator:
// persistence, duplicate and concurrent events, stale-write protection,
// recovery after a missed or failed event, recalculation after edits and
// deletes, Blind Room joins, and cross-user isolation.
// Uses its own uids (ins-alice, ins-bob) and room ids: test files run in
// parallel against one emulator.
// Run via `npm run test:functions` at the repo root (emulators:exec).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { syncAxeInsights: syncCallable } = require("./index.js");
const insights = require("./axeInsights.js");

const db = admin.firestore();
const TODAY = new Date().toISOString().slice(0, 10);

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function fip(rating, extra = {}) {
  return { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 0.8, total: rating, noseAromas: [], palateFlavors: [], ...extra };
}

// Rye clearly out-rates Bourbon: a style-preference insight.
function styledDoc(overrides = {}) {
  return {
    bottles: [
      { id: "r1", name: "Rittenhouse", status: "open", type: "Rye", proof: 100, createdAt: 1 },
      { id: "r2", name: "Pikesville", status: "open", type: "Rye", proof: 110, createdAt: 1 },
      { id: "bb", name: "Maker's Mark", status: "open", type: "Bourbon", proof: 90, createdAt: 1 },
    ],
    pours: [
      { id: "x1", bottleId: "r1", date: daysAgo(200), rating: 9, fip: fip(9) },
      { id: "x2", bottleId: "r2", date: daysAgo(199), rating: 9, fip: fip(9) },
      { id: "x3", bottleId: "r1", date: daysAgo(198), rating: 9, fip: fip(9) },
      { id: "x4", bottleId: "bb", date: daysAgo(197), rating: 7, fip: fip(7) },
      { id: "x5", bottleId: "bb", date: daysAgo(196), rating: 7.4, fip: fip(7.4) },
    ],
    memories: [],
    ...overrides,
  };
}

const call = (uid, data = {}) => syncCallable.run({ auth: { uid }, data: { today: TODAY, ...data } });
const cacheOf = async (uid) => (await db.doc(`users/${uid}/axeInsights/current`).get()).data();

async function resetUser(uid, doc) {
  await db.recursiveDelete(db.doc(`users/${uid}`));
  if (doc) await db.doc(`users/${uid}`).set(doc);
}

beforeEach(async () => {
  // Only this file's own limit docs: other files share the emulator.
  await Promise.all(["ins-alice", "ins-bob"].map((uid) => db.doc(`rateLimits/${uid}_syncAxeInsights`).delete()));
  await resetUser("ins-alice", styledDoc());
  await resetUser("ins-bob", {
    bottles: [{ id: "bob1", name: "Bob Secret Bottle", status: "open", createdAt: 1 }],
    pours: [{ id: "bp1", bottleId: "bob1", date: TODAY, rating: 9.9, fip: fip(9.9) }],
  });
});

describe("syncAxeInsights callable", () => {
  it("rejects unauthenticated calls", async () => {
    await expect(syncCallable.run({ data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("computes from the caller's own data, persists it, and returns only the selected insight", async () => {
    const res = await call("ins-alice");
    expect(res.status).toBe("ready");
    expect(res.changed).toBe(true);
    expect(res.generation).toBe(1);
    expect(res.selected.id).toBe("palate-evolution:style-preference:rye");
    expect(res.selected.copy.body).toBe("Your 3 Rye pours average 9.0, compared with 7.2 for everything else.");
    expect(res).not.toHaveProperty("history");

    const cache = await cacheOf("ins-alice");
    expect(cache.state.generation).toBe(1);
    expect(cache.state.selected.candidate.id).toBe(res.selected.id);
    // Evidence ids and summaries only: no copies of tasting records.
    expect(JSON.stringify(cache)).not.toContain('"fip"');
  });

  it("ignores any uid or statistics in the payload (cross-user isolation)", async () => {
    const res = await call("ins-alice", { uid: "ins-bob", pours: [{ id: "fake", rating: 10 }], stats: { averageRating: 10 } });
    expect(JSON.stringify(res)).not.toContain("Bob Secret Bottle");
    expect(JSON.stringify(res)).not.toContain("fake");
    expect(await cacheOf("ins-bob")).toBeUndefined();

    const bobRes = await call("ins-bob");
    expect(JSON.stringify(bobRes)).not.toContain("Rittenhouse");
    expect((await cacheOf("ins-alice")).state.selected.candidate.id).toBe("palate-evolution:style-preference:rye");
  });

  it("treats a duplicate event as a no-op: no new generation, no rewrite", async () => {
    await call("ins-alice");
    const firstWrite = (await db.doc("users/ins-alice/axeInsights/current").get()).updateTime.toMillis();
    const again = await call("ins-alice");
    expect(again.changed).toBe(false);
    expect(again.generation).toBe(1);
    expect((await db.doc("users/ins-alice/axeInsights/current").get()).updateTime.toMillis()).toBe(firstWrite);
  });

  it("does not recalculate for an unrelated edit (photo, price)", async () => {
    await call("ins-alice");
    const doc = styledDoc();
    doc.bottles = doc.bottles.map((b) => ({ ...b, imageUrl: "https://example.com/x.jpg", price: 60 }));
    await db.doc("users/ins-alice").set(doc);
    const res = await call("ins-alice");
    expect(res.changed).toBe(false);
    expect(res.recalculated).toEqual([]);
  });

  it("recalculates after an edited tasting and keeps the same insight with updated numbers", async () => {
    await call("ins-alice");
    const doc = styledDoc();
    doc.pours = doc.pours.map((p) => (p.id === "x4" ? { ...p, rating: 6.4, fip: fip(6.4) } : p));
    await db.doc("users/ins-alice").set(doc);
    const res = await call("ins-alice");
    expect(res.changed).toBe(true);
    expect(res.generation).toBe(2);
    expect(res.selected.id).toBe("palate-evolution:style-preference:rye");
    expect(res.selected.facts.find((f) => f.key === "otherStylesAverage").value).toBe(6.9);
  });

  it("removes an insight whose supporting tasting was deleted", async () => {
    await call("ins-alice");
    const doc = styledDoc();
    doc.pours = doc.pours.filter((p) => p.id !== "x5"); // one Bourbon pour left: no comparison
    await db.doc("users/ins-alice").set(doc);
    const res = await call("ins-alice");
    expect(res.changed).toBe(true);
    expect(res.selected?.id).not.toBe("palate-evolution:style-preference:rye");
    expect(JSON.stringify((await cacheOf("ins-alice")).state.categories["palate-evolution"].candidates)).not.toContain("style-preference");
  });

  it("recovers after a missed event: the next request of any kind catches up", async () => {
    await call("ins-alice");
    // A tasting saved while the event call failed (offline, closed tab...).
    const doc = styledDoc();
    doc.pours.push({ id: "today", bottleId: "bb", date: TODAY, rating: 9.2, fip: fip(9.2) });
    await db.doc("users/ins-alice").set(doc);
    const res = await call("ins-alice", { reason: "home" });
    expect(res.changed).toBe(true);
    expect(res.selected.kind).toBe("revisit-shift");
  });

  it("recovers after a failed recalculation: nothing is half-written and the retry succeeds", async () => {
    await call("ins-alice");
    const before = await cacheOf("ins-alice");
    const doc = styledDoc();
    doc.pours = doc.pours.filter((p) => p.id !== "x5");
    await db.doc("users/ins-alice").set(doc);

    // Force the blind refresh path to throw on this attempt.
    await db.doc("users/ins-alice/axeInsights/current").update({ "blind.fetchedAt": 0 });
    const original = db.collectionGroup.bind(db);
    const cg = vi.spyOn(db, "collectionGroup").mockImplementationOnce(() => {
      throw new Error("transient failure");
    });
    await expect(call("ins-alice")).rejects.toThrow("transient failure");
    expect((await cacheOf("ins-alice")).state.generation).toBe(before.state.generation);

    cg.mockImplementation(original);
    const retry = await call("ins-alice");
    expect(retry.changed).toBe(true);
    expect(retry.generation).toBe(before.state.generation + 1);
    cg.mockRestore();
  });

  it("never lets a result from older source data overwrite a newer one", async () => {
    await call("ins-alice");
    const ref = db.doc("users/ins-alice/axeInsights/current");
    // Pretend a newer source revision was already processed.
    await ref.update({ "state.sourceRevision": "999999999999999", "state.generation": 7 });
    const res = await call("ins-alice");
    expect(res.stale).toBe(true);
    expect(res.changed).toBe(false);
    expect((await cacheOf("ins-alice")).state.generation).toBe(7);
  });

  it("handles concurrent events without lost or duplicated updates", async () => {
    await call("ins-alice");
    const doc = styledDoc();
    doc.pours.push({ id: "today", bottleId: "bb", date: TODAY, rating: 9.2, fip: fip(9.2) });
    await db.doc("users/ins-alice").set(doc);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => call("ins-alice")));
    // Exactly one of the racing calls applied the change; the rest saw it.
    expect(results.filter((r) => r.changed).length).toBe(1);
    expect(new Set(results.map((r) => r.generation))).toEqual(new Set([2]));
    expect((await cacheOf("ins-alice")).state.generation).toBe(2);
  });

  it("returns the cached insight without recalculating once rate limited", async () => {
    await call("ins-alice");
    await db.doc("rateLimits/ins-alice_syncAxeInsights").set({ count: 999, windowStart: Date.now() });
    const doc = styledDoc();
    doc.pours = doc.pours.filter((p) => p.id !== "x5");
    await db.doc("users/ins-alice").set(doc);
    const res = await call("ins-alice");
    expect(res.limited).toBe(true);
    expect(res.selected.id).toBe("palate-evolution:style-preference:rye");
  });
});

describe("Blind Room results", () => {
  async function seedRoom(id, { state = "revealed", member = "ins-alice", locked = true } = {}) {
    await db.doc(`blindRooms/${id}`).set({ name: "Friday Flight", hostUid: "host", state, revealedAt: Date.now(), pourCount: 2 });
    await db.doc(`blindRooms/${id}/participants/${member}`).set({ uid: member, isHost: false });
    await db.doc(`blindRoomSecrets/${id}`).set({
      roomId: id,
      pours: [
        { label: "A", bottleId: "bb", bottleName: "Maker's Mark" },
        { label: "B", bottleId: "r1", bottleName: "Rittenhouse" },
      ],
    });
    await db.doc(`blindRooms/${id}/participants/${member}/ranking/final`).set({ order: ["A", "B"], status: locked ? "locked" : "in-progress" });
  }

  beforeEach(async () => {
    for (const id of ["ins-room1", "ins-room2", "ins-room3"]) {
      await db.recursiveDelete(db.doc(`blindRooms/${id}`));
      await db.doc(`blindRoomSecrets/${id}`).delete();
    }
  });

  it("uses the user's own locked ranking from revealed rooms, on a blind-reveal event", async () => {
    await call("ins-alice");
    await seedRoom("ins-room1");
    const res = await call("ins-alice", { reason: "blind-reveal" });
    expect(res.selected.id).toBe("blind-discovery:blind-vs-sighted:ins-room1");
    expect(res.selected.copy.body).toContain("Blind, you preferred Maker's Mark over Rittenhouse");
  });

  it("ignores unrevealed rooms, unlocked rankings and other people's rooms", async () => {
    await seedRoom("ins-room1", { state: "active" });
    await seedRoom("ins-room2", { locked: false });
    await seedRoom("ins-room3", { member: "ins-bob" });
    const tastings = await insights.loadBlindTastings(db, "ins-alice");
    expect(tastings.map((t) => t.roomId)).toEqual(["ins-room2"]);
    expect(tastings[0].pours.every((p) => p.blindRank === undefined)).toBe(true);
  });
});

describe("request helpers", () => {
  it("accepts the client's date only within a day of UTC", () => {
    const now = Date.parse("2026-10-12T03:00:00Z");
    expect(insights.resolveToday("2026-10-11", now)).toBe("2026-10-11");
    expect(insights.resolveToday("2026-10-13", now)).toBe("2026-10-13");
    expect(insights.resolveToday("2026-01-01", now)).toBe("2026-10-12");
    expect(insights.resolveToday("not a date", now)).toBe("2026-10-12");
  });

  it("only honors known reasons", () => {
    expect(insights.sanitizeRequest({ reason: "request-new" })).toMatchObject({ requestNew: true });
    expect(insights.sanitizeRequest({ reason: "drop tables" })).toMatchObject({ reason: "data-changed", requestNew: false });
  });
});
