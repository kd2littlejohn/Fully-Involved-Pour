// Scan Barcode on Add Bottle (docs/BARCODE_POC.md). Cheapest and most
// trusted first; Google for an unknown barcode; AXE when Google can't.
//
// lookupBarcode({ barcode, useGoogle?, useAxe? })
//   1. upcMappings/{gtin13}.candidates          FIP-verified releases (shared)
//   2. users/{uid}/barcodeEntries (this gtin13)  this user's own saved entries
//      The plain call stops here and says whether Google is available; the
//      app then asks again with useGoogle when nothing matched.
//   3. useGoogle: Gemini + Grounding with Google Search. Off unless
//      GEMINI_ENABLED; skipped (never an error) when over the monthly
//      budget, over the user's hourly limit, or without App Check when that
//      is required. Grounded results are never stored (Google's terms).
//   4. useAxe: Claude + web search, when the user asks after Google
//      couldn't identify it. Reusing a recent unverified Claude suggestion
//      (upcPending) is built in but OFF (REUSE_AI_SUGGESTIONS).
//
// identifyBottleLabel({ barcode?, imageBase64, mediaType })
//   "Scan Front Label with AXE": Claude reads the label photo, combined with
//   the barcode when there is one. Never cached (it describes one photo).
//
// The AI paths are open to any signed-in FIP user, rate-limited per user
// per hour; the catalog lookup is free.
//
// One barcode can return several candidates. Nothing here picks one: the
// user chooses, and only what they confirm is saved (to their own private
// barcodeEntries, client-side). Another user's entries are never read, and
// nothing becomes shared until an administrator verifies it into
// upcMappings (scripts/barcode-review.js). As that catalog grows, fewer
// scans reach step 3.

const { FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { normalizeBarcode } = require("./gtin");
const { identifyWithClaude } = require("./providers/claude");
const { identifyWithGemini, DEFAULT_GEMINI_MODEL } = require("./providers/gemini");

const AI_LOOKUPS_PER_HOUR = 20;
const LABEL_SCANS_PER_HOUR = 20;
const GOOGLE_LOOKUPS_PER_HOUR = 30;
// Charged against the monthly budget when Google reports no usage.
const GOOGLE_FALLBACK_COST_USD = 0.05;
// How long an unverified Claude suggestion is reused for the same barcode.
const AI_SUGGESTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Off until Anthropic's terms for storing web-search-derived output are
// signed off, and so Phase 0 latency/cost numbers aren't skewed by reuse.
const REUSE_AI_SUGGESTIONS = false;
const MAX_IMAGE_BASE64 = 7000000;

const BOTTLE_FIELDS = [
  "name", "distillery", "brand", "expression", "category", "sizeMl", "proof",
  "proofVaries", "ageStatement", "releaseKind", "batch", "barrel", "storePick", "releaseYear",
];

function pickBottle(data) {
  const bottle = {};
  for (const key of BOTTLE_FIELDS) {
    const value = data?.[key];
    bottle[key] = value === undefined ? null : value;
  }
  bottle.proofVaries = bottle.proofVaries === true;
  return bottle;
}

// Verified candidates. A mapping written before candidates existed (one flat
// product) still reads as a single candidate.
function verifiedCandidates(gtin13, data) {
  if (!data || data.status !== "verified") return [];
  const list = Array.isArray(data.candidates) ? data.candidates : [data];
  return list
    .filter((c) => c && typeof c.name === "string" && c.name.trim())
    .map((c, i) => ({ id: typeof c.id === "string" ? c.id : `${gtin13}-${i + 1}`, ...pickBottle(c) }));
}

function costUsd(call) {
  return typeof call?.cost?.total === "number" ? call.cost.total : null;
}

async function readCatalog(db, uid, gtin13) {
  const [mapping, entries] = await Promise.all([
    db.doc(`upcMappings/${gtin13}`).get(),
    db.collection(`users/${uid}/barcodeEntries`).where("gtin13", "==", gtin13).limit(20).get(),
  ]);
  return {
    verified: verifiedCandidates(gtin13, mapping.exists ? mapping.data() : null),
    yours: entries.docs.map((doc) => {
      const d = doc.data();
      return {
        entryId: doc.id,
        origin: d.origin || "manual",
        candidateId: d.candidateId || null,
        bottleId: d.bottleId || null,
        submitForReview: d.submitForReview === true,
        bottle: pickBottle(d.bottle),
      };
    }),
  };
}

function monthKey(ms) {
  return new Date(ms).toISOString().slice(0, 7);
}

// Whether Google may be asked right now. Never throws: anything but
// "available" just means the app offers AXE instead.
async function googleAvailability(db, request, google, now) {
  if (!google || !google.enabled || !google.apiKey) return "off";
  if (google.requireAppCheck && !request.app) return "app-check";
  const spend = await db.doc(`aiSpend/gemini-${monthKey(now())}`).get();
  const spent = spend.exists ? spend.data().estimatedUsd || 0 : 0;
  if (spent >= google.monthlyBudgetUsd) return "budget";
  return "available";
}

async function askGoogle(db, request, { normalized, google, assertNotRateLimited, now, pendingRef }) {
  const availability = await googleAvailability(db, request, google, now);
  if (availability !== "available") return { status: availability };
  try {
    await assertNotRateLimited(request.auth.uid, "lookupBarcodeGoogle", { maxCalls: GOOGLE_LOOKUPS_PER_HOUR });
  } catch (error) {
    if (error?.code === "resource-exhausted") return { status: "rate-limited" };
    throw error;
  }
  let call;
  try {
    call = await (google.identify || identifyWithGemini)({ apiKey: google.apiKey, model: google.model || DEFAULT_GEMINI_MODEL, normalized, mode: "upc" });
  } catch (error) {
    console.error("Google barcode lookup failed", error.message);
    return { status: "error" };
  }
  const { guard, ...result } = call.result;
  const cost = costUsd(call);
  console.log(
    "Google barcode lookup",
    JSON.stringify({ gtin13: normalized.gtin13, model: call.model, identified: result.identified, candidates: result.candidates.length, guard, latencyMs: call.latencyMs, cost: call.cost }),
  );
  // Counts only — Google's terms don't allow storing grounded results.
  await Promise.all([
    db.doc(`aiSpend/gemini-${monthKey(now())}`).set(
      {
        calls: FieldValue.increment(1),
        searchQueries: FieldValue.increment(call.usage?.webSearchQueries || 0),
        estimatedUsd: FieldValue.increment(cost ?? GOOGLE_FALLBACK_COST_USD),
        updatedAt: now(),
      },
      { merge: true },
    ),
    pendingRef.set({ gtin13: normalized.gtin13, googleLookups: FieldValue.increment(1), lastLookupAt: now() }, { merge: true }),
  ]);
  return {
    status: result.identified ? "identified" : "not-found",
    result,
    searchEntryPoint: call.searchEntryPoint,
    latencyMs: call.latencyMs,
    costUsd: cost,
    model: call.model,
  };
}

async function handleLookupBarcode(db, request, { apiKey, google = null, assertNotRateLimited, now = Date.now, reuseAiSuggestions = REUSE_AI_SUGGESTIONS }) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to look up barcodes.");
  const uid = request.auth.uid;

  const normalized = normalizeBarcode(request.data?.barcode);
  if (normalized.error) throw new HttpsError("invalid-argument", "That isn't a valid UPC or EAN barcode.");
  const { gtin13 } = normalized;
  const base = { gtin13, upcA: normalized.upcA || null, symbology: normalized.symbology };
  if (normalized.restricted) return { ...base, status: "restricted", verified: [], yours: [] };

  const { verified, yours } = await readCatalog(db, uid, gtin13);
  const pendingRef = db.doc(`upcPending/${gtin13}`);
  const matched = verified.length > 0 || yours.length > 0;

  if (request.data?.useGoogle === true) {
    const googleResult = await askGoogle(db, request, { normalized, google, assertNotRateLimited, now, pendingRef });
    return {
      ...base,
      status: googleResult.status === "identified" ? "suggested" : matched ? "matched" : "not-found",
      verified,
      yours,
      google: googleResult,
    };
  }

  if (request.data?.useAxe !== true) {
    if (!matched) {
      // Demand signal for the review queue; no AI content involved.
      await pendingRef.set(
        { gtin13, lookups: FieldValue.increment(1), lastLookupAt: now() },
        { merge: true },
      );
    }
    return {
      ...base,
      status: matched ? "matched" : "no-match",
      verified,
      yours,
      googleAvailable: (await googleAvailability(db, request, google, now)) === "available",
    };
  }

  const pending = reuseAiSuggestions ? await pendingRef.get() : null;
  const cached = pending?.exists ? pending.data().suggestion : null;
  if (cached && cached.provider === "claude" && cached.expiresAt > now() && cached.result) {
    return { ...base, status: cached.result.identified ? "suggested" : "not-found", verified, yours, axe: { ...cached.result, cached: true }, latencyMs: 0, costUsd: 0 };
  }

  await assertNotRateLimited(uid, "lookupBarcode", { maxCalls: AI_LOOKUPS_PER_HOUR });
  let call;
  try {
    call = await identifyWithClaude({ apiKey, normalized, mode: "upc" });
  } catch (error) {
    console.error("Barcode AI lookup failed", error.message);
    throw new HttpsError("internal", "AXE can't look this barcode up right now.");
  }
  const { guard, ...result } = call.result;
  console.log(
    "Barcode AI lookup",
    JSON.stringify({ gtin13, model: call.model, identified: result.identified, candidates: result.candidates.length, guard, latencyMs: call.latencyMs, cost: call.cost }),
  );
  // Claude output only (never Gemini — Google's terms don't allow storing
  // grounded results). Unverified; server-only; reused for a limited time, and only
  // when reuse is switched on. The lookup count is kept either way.
  await pendingRef.set(
    {
      gtin13,
      aiLookups: FieldValue.increment(1),
      lastLookupAt: now(),
      ...(reuseAiSuggestions
        ? { suggestion: { provider: "claude", model: call.model, at: now(), expiresAt: now() + AI_SUGGESTION_TTL_MS, result } }
        : {}),
    },
    { merge: true },
  );
  return {
    ...base,
    status: result.identified ? "suggested" : "not-found",
    verified,
    yours,
    axe: { ...result, cached: false },
    latencyMs: call.latencyMs,
    costUsd: costUsd(call),
    model: call.model,
  };
}

async function handleIdentifyBottleLabel(db, request, { apiKey, assertNotRateLimited }) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to scan labels with AXE.");
  const uid = request.auth.uid;

  const imageBase64 = String(request.data?.imageBase64 || "");
  const mediaType = String(request.data?.mediaType || "image/jpeg");
  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) throw new HttpsError("invalid-argument", "Unsupported image type.");
  if (imageBase64.length < 100) throw new HttpsError("invalid-argument", "A label photo is required.");
  if (imageBase64.length > MAX_IMAGE_BASE64) throw new HttpsError("invalid-argument", "Photo is too large. Try a smaller photo.");

  let normalized = null;
  if (request.data?.barcode) {
    normalized = normalizeBarcode(request.data.barcode);
    if (normalized.error) throw new HttpsError("invalid-argument", "That isn't a valid UPC or EAN barcode.");
    if (normalized.restricted) normalized = null;
  }

  await assertNotRateLimited(uid, "identifyBottleLabel", { maxCalls: LABEL_SCANS_PER_HOUR });
  let call;
  try {
    call = await identifyWithClaude({ apiKey, normalized, photo: { base64: imageBase64, mediaType }, mode: "label" });
  } catch (error) {
    console.error("Label identification failed", error.message);
    throw new HttpsError("internal", "AXE can't read this label right now.");
  }
  const { guard, ...result } = call.result;
  console.log(
    "Label identification",
    JSON.stringify({ gtin13: normalized?.gtin13 || null, model: call.model, identified: result.identified, candidates: result.candidates.length, label: Boolean(result.label), guard, latencyMs: call.latencyMs, cost: call.cost }),
  );
  return {
    gtin13: normalized?.gtin13 || null,
    status: result.identified ? "suggested" : "not-found",
    axe: { ...result, cached: false },
    latencyMs: call.latencyMs,
    costUsd: costUsd(call),
    model: call.model,
  };
}

module.exports = { handleLookupBarcode, handleIdentifyBottleLabel, AI_LOOKUPS_PER_HOUR, LABEL_SCANS_PER_HOUR, GOOGLE_LOOKUPS_PER_HOUR, AI_SUGGESTION_TTL_MS, REUSE_AI_SUGGESTIONS };
