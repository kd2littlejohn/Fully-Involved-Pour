// Exercises the real assertNotRateLimited against the actual Firestore
// emulator (via the Admin SDK) -- the one piece of rarity backend logic
// that genuinely can't be unit-tested with a fake, since its whole job is
// a real Firestore read-then-write race. Run via `npm run test:functions`
// at the repo root, which wraps this in `firebase emulators:exec --only
// firestore` exactly like the existing `test:rules` script does.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import admin from "firebase-admin";
import rateLimit from "./rateLimit.js";

const { assertNotRateLimited } = rateLimit;

const app = admin.initializeApp({ projectId: "fip-functions-test" });
const db = admin.firestore(app);

async function clearRateLimits() {
  const snap = await db.collection("rateLimits").get();
  await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
}

beforeEach(async () => {
  await clearRateLimits();
});

afterAll(async () => {
  await app.delete();
});

describe("assertNotRateLimited (real Firestore emulator)", () => {
  it("allows calls under the default cap and rejects the 21st within the window", async () => {
    const uid = "user-default-cap";
    for (let i = 0; i < 20; i++) {
      await expect(assertNotRateLimited(uid, "someOperation")).resolves.toBeUndefined();
    }
    await expect(assertNotRateLimited(uid, "someOperation")).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("honors a raised custom cap (suggestBottleRarity's 100/hour) independently of the default", async () => {
    const uid = "user-custom-cap";
    for (let i = 0; i < 100; i++) {
      await expect(assertNotRateLimited(uid, "suggestBottleRarity", { maxCalls: 100 })).resolves.toBeUndefined();
    }
    await expect(assertNotRateLimited(uid, "suggestBottleRarity", { maxCalls: 100 })).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("keeps rate limits independent per operation for the same user", async () => {
    const uid = "user-per-operation";
    for (let i = 0; i < 20; i++) {
      await assertNotRateLimited(uid, "operationA");
    }
    await expect(assertNotRateLimited(uid, "operationA")).rejects.toMatchObject({ code: "resource-exhausted" });
    // A different operation for the same user is a fresh counter.
    await expect(assertNotRateLimited(uid, "operationB")).resolves.toBeUndefined();
  });

  it("resets the window once windowMs has elapsed", async () => {
    const uid = "user-window-reset";
    const ref = db.doc(`rateLimits/${uid}_shortWindow`);
    // Seed a counter that's already at the cap, but with a windowStart far
    // enough in the past that a 1ms window has already elapsed.
    await ref.set({ count: 5, windowStart: Date.now() - 1000 });
    await expect(assertNotRateLimited(uid, "shortWindow", { maxCalls: 5, windowMs: 1 })).resolves.toBeUndefined();
  });
});
