// Lightweight, best-effort per-user rate limit for the FIP Intelligence
// Layer endpoints. Backed by a small doc written only via the Admin SDK, so
// it needs no client-facing Firestore rule. Not perfectly race-proof under
// truly simultaneous calls from the same user -- an acceptable trade-off
// for a soft cap, not a billing guardrail.
//
// Split out of index.js so it's testable directly against the real
// Firestore emulator (see rateLimit.test.js) without needing to also wrap
// a whole onCall handler.
const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const RATE_LIMIT_MAX_CALLS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function assertNotRateLimited(uid, operation, options) {
  const opts = options || {};
  const maxCalls = typeof opts.maxCalls === "number" ? opts.maxCalls : RATE_LIMIT_MAX_CALLS;
  const windowMs = typeof opts.windowMs === "number" ? opts.windowMs : RATE_LIMIT_WINDOW_MS;
  const ref = admin.firestore().doc(`rateLimits/${uid}_${operation}`);
  const snap = await ref.get();
  const now = Date.now();
  const data = snap.exists ? snap.data() : {};
  const withinWindow = typeof data.windowStart === "number" && now - data.windowStart < windowMs;
  const count = withinWindow ? data.count || 0 : 0;

  if (withinWindow && count >= maxCalls) {
    throw new HttpsError("resource-exhausted", "You've hit the limit for this right now -- try again in a bit.");
  }

  await ref.set({ count: count + 1, windowStart: withinWindow ? data.windowStart : now });
}

module.exports = { RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_MS, assertNotRateLimited };
