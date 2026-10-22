// lookupBarcode — Scan Barcode proof of concept. Order of lookups, cheapest
// and most trusted first, and AI is only ever the last step:
//
//   1. upcMappings/{gtin13}                      administrator-verified
//   2. upcConfirmations/{gtin13}/confirmedBy/{uid}  this user's own confirmation
//   3. Claude + web search                       unknown to FIP
//
// One user's confirmation never answers another user's scan: confirmations
// stay private until an administrator promotes one to upcMappings by hand,
// so a mistaken identification can't spread. AI answers are returned, not
// stored — they only reach Firestore once the user confirms (or corrects)
// them on the client. Restricted (store-applied) barcodes skip all three.

const { HttpsError } = require("firebase-functions/v2/https");
const { normalizeBarcode } = require("./gtin");
const { identifyWithClaude } = require("./providers/claude");

const AI_LOOKUPS_PER_HOUR = 20;

function mappingFields(data) {
  return {
    name: data.name || null,
    distillery: data.distillery || null,
    brand: data.brand || null,
    expression: data.expression || null,
    category: data.category || null,
    sizeMl: typeof data.sizeMl === "number" ? data.sizeMl : null,
    proof: typeof data.proof === "number" ? data.proof : null,
    proofVaries: data.proofVaries === true,
    ageStatement: data.ageStatement || null,
    upcSharedAcrossVariants: data.upcSharedAcrossVariants === true,
  };
}

async function handleLookupBarcode(db, request, { apiKey, assertNotRateLimited }) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to look up barcodes.");
  const uid = request.auth.uid;

  const normalized = normalizeBarcode(request.data?.barcode);
  if (normalized.error) throw new HttpsError("invalid-argument", "That isn't a valid UPC or EAN barcode.");
  const { gtin13 } = normalized;
  const base = { gtin13, upcA: normalized.upcA || null, symbology: normalized.symbology };

  if (normalized.restricted) return { ...base, source: "restricted" };

  const verified = await db.doc(`upcMappings/${gtin13}`).get();
  if (verified.exists && verified.data().status === "verified") {
    return { ...base, source: "verified", bottle: mappingFields(verified.data()) };
  }

  const own = await db.doc(`upcConfirmations/${gtin13}/confirmedBy/${uid}`).get();
  if (own.exists) {
    return { ...base, source: "your-confirmation", bottle: mappingFields(own.data()), bottleId: own.data().bottleId || null };
  }

  if (request.data?.skipAi === true) return { ...base, source: "unknown" };

  await assertNotRateLimited(uid, "lookupBarcode", { maxCalls: AI_LOOKUPS_PER_HOUR });
  let ai;
  try {
    ai = await identifyWithClaude({ apiKey, normalized });
  } catch (error) {
    console.error("Barcode AI lookup failed", error.message);
    throw new HttpsError("internal", "Barcode lookup is unavailable right now.");
  }
  console.log(
    "Barcode AI lookup",
    JSON.stringify({ gtin13, model: ai.model, identified: ai.result.identified, guard: ai.result.guard, latencyMs: ai.latencyMs, cost: ai.cost }),
  );

  if (!ai.result.identified) return { ...base, source: "not-found", latencyMs: ai.latencyMs };
  const { guard: _guard, ...result } = ai.result;
  return { ...base, source: "ai", bottle: result, latencyMs: ai.latencyMs, model: ai.model };
}

module.exports = { handleLookupBarcode, AI_LOOKUPS_PER_HOUR };
