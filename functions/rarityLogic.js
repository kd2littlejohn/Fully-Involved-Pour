// Pure(ish) logic behind the suggestBottleRarity callable, split out of
// index.js specifically so it's independently testable without the Firebase
// emulator or a wrapping test framework — see rarityLogic.test.js. The
// onCall wrapper in index.js stays a 3-line delegator to
// handleSuggestBottleRarity, injected with its real dependencies
// (callClaude, assertNotRateLimited) — that keeps the auth/rate-limit
// wiring itself covered by these same tests, not just the guards in
// isolation.
const { HttpsError } = require("firebase-functions/v2/https");

const RARITY_LEVELS = ["common", "uncommon", "rare", "unicorn"];
const CONFIDENCE_LEVELS = ["high", "medium", "low"];
// Bumped when 'allocated' was removed as its own level -- invalidates every
// previously-cached suggestion (see RARITY_CLASSIFIER_VERSION in
// web/src/data/repositories/rarity.ts, which must always match this).
const CLASSIFIER_VERSION = "rarity-v2";

const DECLINED_REASON = "We couldn't confidently place this bottle on the rarity scale.";

const RARITY_SYSTEM_PROMPT = `You classify how hard a whiskey bottle is to actually get, for a whiskey-journaling app called Fully Involved Pour. You are making a SUGGESTION the owner will review and accept or change -- never an absolute market guarantee. Availability varies by region and over time.

Use exactly these four levels:
- "common": broadly and regularly available on ordinary retail shelves.
- "uncommon": intermittent, regional, or takes moderate searching, but obtainable at retail without a lottery.
- "rare": genuinely hard to get at retail even for someone actively trying -- very limited production or release, or deliberately limited by the producer/distributor via store allocations, drawings, lotteries, or scheduled releases.
- "unicorn": exceptionally scarce and highly sought after -- discontinued, ultra-limited, or rarely obtainable even through allocations.

Judge ONLY from the identity and metadata you are given: full name, distillery, type, age statement, proof, release or edition wording, limited-edition indicators, single-barrel or store-pick status, and this exact product's genuinely well-known distribution pattern. Price must NEVER determine rarity -- an expensive bottle is not automatically rare, and an inexpensive one is not automatically common. A single-barrel store pick is NOT automatically rare or unicorn; most store picks of a widely available product are still common or uncommon.

If you do not confidently recognize this exact product, or cannot place it on the scale honestly, set "rarity" to null rather than guessing. Never invent a release, a production volume, or an allocation program you do not actually know about.

Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"rarity": "common" or "uncommon" or "rare" or "unicorn" or null, "confidence": "high" or "medium" or "low", "reason": "one or two short sentences, phrased as a suggestion (\\"Usually...\\", \\"Typically...\\", \\"Availability varies, but...\\"), never an absolute market claim", "normalizedBottleName": "the canonical product name as you recognize it, or empty string"}`;

function clamp(str, max) {
  return String(str || "").trim().slice(0, max);
}

// Deliberately no price/msrp field anywhere in this shape -- "price alone
// must never determine rarity" is enforced structurally by never handing
// the model a price to reach for, not just by asking it nicely.
function buildRarityPrompt(data) {
  const input = data || {};
  const bottleName = clamp(input.bottleName, 200);
  if (bottleName.length < 3) {
    throw new HttpsError("invalid-argument", "A bottle name is required.");
  }

  const distillery = clamp(input.distillery, 120);
  const type = clamp(input.type, 60);
  const region = clamp(input.region, 60);
  const ageStatement = clamp(input.ageStatement, 60);
  const proofNum = Number(input.proof);
  const proof = Number.isFinite(proofNum) && proofNum > 0 && proofNum <= 200 ? proofNum : undefined;
  const singleBarrel = Boolean(input.singleBarrel);
  const storePick = Boolean(input.storePick);

  const facts = [
    `Bottle: ${bottleName}`,
    distillery ? `Distillery: ${distillery}` : null,
    type ? `Type: ${type}` : null,
    region ? `Region: ${region}` : null,
    ageStatement ? `Age statement: ${ageStatement}` : null,
    proof ? `Proof: ${proof}` : null,
    singleBarrel ? "Single barrel: yes" : null,
    storePick ? "Store pick / private selection: yes" : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { system: RARITY_SYSTEM_PROMPT, prompt: facts };
}

// Never throws -- a parse failure, an invalid rarity, an invalid
// confidence, or a rarity with no stated reason all fall back to a
// declined (`rarity: null`) suggestion rather than surfacing an error or
// inventing a classification.
function sanitizeRaritySuggestion(raw, now) {
  const generatedAt = typeof now === "number" ? now : Date.now();
  const declined = (reason) => ({
    rarity: null,
    confidence: "low",
    reason: reason || DECLINED_REASON,
    generatedAt,
    classifierVersion: CLASSIFIER_VERSION,
  });

  let parsed;
  try {
    parsed = JSON.parse(String(raw || "").trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse rarity JSON", raw);
    return declined();
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return declined();
  }

  const rarityRaw = typeof parsed.rarity === "string" ? parsed.rarity.trim().toLowerCase() : null;
  let rarity = RARITY_LEVELS.includes(rarityRaw) ? rarityRaw : null;

  const confidenceRaw = typeof parsed.confidence === "string" ? parsed.confidence.trim().toLowerCase() : "";
  const confidence = CONFIDENCE_LEVELS.includes(confidenceRaw) ? confidenceRaw : "low";

  const reason = clamp(parsed.reason, 240);
  // A classification with no stated basis isn't reviewable -- treat it the
  // same as a decline rather than showing the owner an unexplained level.
  if (rarity && !reason) {
    rarity = null;
  }

  const normalizedBottleName = clamp(parsed.normalizedBottleName, 200) || undefined;

  return {
    rarity,
    confidence,
    reason: reason || DECLINED_REASON,
    normalizedBottleName,
    generatedAt,
    classifierVersion: CLASSIFIER_VERSION,
  };
}

async function handleSuggestBottleRarity(request, deps) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to get a rarity suggestion.");
  }

  await deps.assertNotRateLimited(request.auth.uid, "suggestBottleRarity", { maxCalls: 100 });

  const { system, prompt } = buildRarityPrompt(request.data);
  const raw = await deps.callClaude(deps.apiKey(), { system, prompt, maxTokens: 300 });
  return sanitizeRaritySuggestion(raw, deps.now ? deps.now() : Date.now());
}

module.exports = {
  RARITY_LEVELS,
  CONFIDENCE_LEVELS,
  CLASSIFIER_VERSION,
  buildRarityPrompt,
  sanitizeRaritySuggestion,
  handleSuggestBottleRarity,
};
