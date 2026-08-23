const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

async function callClaude(apiKey, { system, prompt, maxTokens, content, messages }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens || 400,
      system,
      messages: messages || [{ role: "user", content: content || prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error", response.status, errorText);
    throw new HttpsError("internal", "The AI sommelier is unavailable right now.");
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

const RATE_LIMIT_MAX_CALLS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Lightweight, best-effort per-user rate limit for the newer, more
// expensive FIP Intelligence Layer endpoints. Backed by a small doc written
// only via the Admin SDK, so it needs no client-facing Firestore rule.
// Not perfectly race-proof under truly simultaneous calls from the same
// user -- an acceptable trade-off for a soft cap, not a billing guardrail.
async function assertNotRateLimited(uid, operation) {
  const ref = admin.firestore().doc(`rateLimits/${uid}_${operation}`);
  const snap = await ref.get();
  const now = Date.now();
  const data = snap.exists ? snap.data() : {};
  const withinWindow = typeof data.windowStart === "number" && now - data.windowStart < RATE_LIMIT_WINDOW_MS;
  const count = withinWindow ? data.count || 0 : 0;

  if (withinWindow && count >= RATE_LIMIT_MAX_CALLS) {
    throw new HttpsError("resource-exhausted", "You've hit the limit for this right now -- try again in a bit.");
  }

  await ref.set({ count: count + 1, windowStart: withinWindow ? data.windowStart : now });
}

const SOMMELIER_PERSONA = `You are a refined, knowledgeable whiskey sommelier helping someone manage their personal bourbon and whiskey collection in an app called "Fully Involved Pour" (tagline: "Where there's proof, there's fire."). Speak with warmth and expertise, like a trusted sommelier, not a chatbot. Be concise: 2-4 sentences. Reference their actual collection naturally when it's given to you. Never invent specific bottle data you weren't given.`;

exports.askSommelier = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to ask the sommelier.");
  }

  const prompt = String(request.data?.prompt || "").trim();
  const collectionSummary = String(request.data?.collectionSummary || "").slice(0, 4000);
  if (!prompt) {
    throw new HttpsError("invalid-argument", "A question or prompt is required.");
  }

  // Prior turns from this chat, so the assistant actually remembers what was asked
  // before instead of answering each message in isolation. Sanitized and capped so a
  // malformed or oversized payload can't blow up token usage or the request shape.
  const rawHistory = Array.isArray(request.data?.history) ? request.data.history : [];
  const history = rawHistory
    .filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
    .slice(-16)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }));

  const system = `${SOMMELIER_PERSONA}\n\nHere is a summary of their current collection:\n${collectionSummary || "(their collection is empty so far)"}`;
  const messages = [...history, { role: "user", content: prompt }];
  const reply = await callClaude(anthropicApiKey.value(), { system, messages, maxTokens: 400 });
  return { reply: reply || "I couldn't come up with a response just now — try rephrasing." };
});

exports.lookupBottleInfo = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to use AI bottle lookup.");
  }

  const bottleName = String(request.data?.bottleName || "").trim();
  if (bottleName.length < 3) {
    throw new HttpsError("invalid-argument", "A bottle name is required.");
  }

  const system = `You are a whiskey/spirits database expert. Given a bottle name, identify its real-world distillery, spirit type, region, typical bottled proof, age statement, and mash bill, ONLY if you genuinely recognize this as a real, existing product. Mash bill is frequently proprietary or undisclosed even for well-known bottles -- only include it when you actually know the real published percentages, and set each unknown mash bill component to 0 rather than guessing a plausible split. If you do not recognize the bottle or are not confident, set "known" to false and leave the other fields empty -- never invent or guess plausible-sounding but unverified details. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:\n{"known": true or false, "distillery": "...", "type": "Bourbon|Rye|Scotch|Irish|Tequila|Rum|Other Spirit", "region": "...", "proof": number or 0, "ageStatement": "..." or "", "mashBillCorn": number or 0, "mashBillRyeWheat": number or 0, "mashBillMalted": number or 0}`;

  const prompt = `Bottle name: ${bottleName}`;

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt, maxTokens: 250 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse bottle lookup JSON", raw);
    return { known: false };
  }

  if (!parsed.known) return { known: false };

  return {
    known: true,
    distillery: String(parsed.distillery || ""),
    type: String(parsed.type || ""),
    region: String(parsed.region || ""),
    proof: Number(parsed.proof || 0),
    ageStatement: String(parsed.ageStatement || ""),
    mashBillCorn: Number(parsed.mashBillCorn || 0),
    mashBillRyeWheat: Number(parsed.mashBillRyeWheat || 0),
    mashBillMalted: Number(parsed.mashBillMalted || 0),
  };
});

exports.lookupDistillery = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to look up distillery info.");
  }

  const distilleryName = String(request.data?.distilleryName || "").trim();
  if (distilleryName.length < 2) {
    throw new HttpsError("invalid-argument", "A distillery name is required.");
  }

  const system = `You are a whiskey/spirits industry expert. Given a distillery name, provide real background facts about it, ONLY if you genuinely recognize this as a real, existing distillery. If you do not recognize it or are not confident, set "known" to false and leave the other fields empty -- never invent or guess plausible-sounding but unverified details. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"known": true or false, "location": "city, state/country", "founded": year as a number or 0, "parentCompany": "owning company, or empty string if independent/unknown", "description": "one or two concise sentences about the distillery's style or history"}`;

  const prompt = `Distillery name: ${distilleryName}`;

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt, maxTokens: 250 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse distillery lookup JSON", raw);
    return { known: false };
  }

  if (!parsed.known) return { known: false };

  return {
    known: true,
    location: String(parsed.location || ""),
    founded: Number(parsed.founded || 0),
    parentCompany: String(parsed.parentCompany || ""),
    description: String(parsed.description || ""),
  };
});

exports.generateTastingProfile = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to generate an AI tasting note.");
  }

  const { bottleName, distillery, type, proof, flavors } = request.data || {};
  if (!String(bottleName || "").trim()) {
    throw new HttpsError("invalid-argument", "Bottle name is required.");
  }

  const system = `${SOMMELIER_PERSONA}\n\nRespond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:\n{"nose": "one concise sentence", "palate": "one concise sentence", "finish": "one concise sentence", "flavors": ["3-6 single or two-word flavor descriptor tags, lowercase"]}`;

  const prompt = `Bottle: ${bottleName}\nDistillery: ${distillery || "unknown"}\nType: ${type || "unknown"}\nProof: ${proof || "unknown"}\nKnown flavor tags so far: ${(Array.isArray(flavors) ? flavors : []).join(", ") || "none"}\n\nGenerate a plausible, expert tasting profile for this bottle.`;

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt, maxTokens: 300 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse tasting profile JSON", raw);
    throw new HttpsError("internal", "Could not parse the AI's tasting profile.");
  }

  return {
    nose: String(parsed.nose || ""),
    palate: String(parsed.palate || ""),
    finish: String(parsed.finish || ""),
    flavors: Array.isArray(parsed.flavors) ? parsed.flavors.map((flavor) => String(flavor).toLowerCase()).slice(0, 6) : [],
  };
});

// The FIP Guide is canonical, shared reference content for a bottle (not
// per-user) — generated once and cached in Firestore by the caller (see
// web/src/data/repositories/fipGuide.ts), never regenerated on every view.
// Every claim here has to be grounded in the real facts passed in or in
// genuinely well-known public information about this exact product.
exports.generateFipGuide = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to generate a FIP Guide.");
  }

  const { bottleName, distillery, type, proof, ageStatement, mashBill, msrp } = request.data || {};
  const name = String(bottleName || "").trim();
  if (name.length < 3) {
    throw new HttpsError("invalid-argument", "A bottle name is required.");
  }

  // v2 schema: story/special/expectSummary/expectFlavors/buyIf/passIf/verdict.
  // Confidence is deliberately NOT part of this response -- it's computed
  // client-side from factual bottle completeness (see fipGuide.ts), never
  // from the model's own self-assessment.
  const system = `You are the FIP Guide writer for a whiskey-journaling app called Fully Involved Pour. Given real facts about a bottle, write a short, honest, scannable guide -- confident but never promotional. A "good bottle" is not automatically "good value," and not every bottle is worth buying -- say so plainly when that's true. Ground every claim in the facts you're given, or in genuinely well-known, verifiable public information about this exact product. Never invent a mash bill, age statement, history, rarity claim, or a specific price you don't actually know, and never cite a specific current secondary-market price. If you do not recognize this bottle confidently, set "known" to false and leave the other fields empty or omitted. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"known": true or false, "story": "2-4 short sentences of real background, or empty string if not confident", "special": ["up to 3 short bullets on what makes this bottle interesting"], "expectSummary": "one concise sentence describing the overall tasting experience", "expectFlavors": ["3-5 single or two-word flavor tags"], "buyIf": ["up to 3 short bullets, each a reason to buy it"], "passIf": ["up to 2 short bullets, each a reason to pass on it"], "verdict": "one short closing sentence", "availability": "one short phrase such as Limited, Widely Available, or Allocated, or empty string if unknown", "intensity": number from 0 (light) to 1 (bold), or null if unsure}`;

  const facts = [
    `Bottle: ${name}`,
    distillery ? `Distillery: ${distillery}` : null,
    type ? `Type: ${type}` : null,
    proof ? `Proof: ${proof}` : null,
    ageStatement ? `Age statement: ${ageStatement}` : null,
    mashBill ? `Mash bill: ${mashBill}` : null,
    msrp ? `MSRP: $${msrp}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt: facts, maxTokens: 700 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse FIP Guide JSON", raw);
    return { known: false };
  }

  if (!parsed.known) return { known: false };

  const intensity = typeof parsed.intensity === "number" && parsed.intensity >= 0 && parsed.intensity <= 1 ? parsed.intensity : null;

  return {
    known: true,
    story: parsed.story ? String(parsed.story) : null,
    special: Array.isArray(parsed.special) ? parsed.special.map((s) => String(s)).slice(0, 3) : [],
    expectSummary: String(parsed.expectSummary || ""),
    expectFlavors: Array.isArray(parsed.expectFlavors) ? parsed.expectFlavors.map((f) => String(f)).slice(0, 5) : [],
    buyIf: Array.isArray(parsed.buyIf) ? parsed.buyIf.map((s) => String(s)).slice(0, 3) : [],
    passIf: Array.isArray(parsed.passIf) ? parsed.passIf.map((s) => String(s)).slice(0, 2) : [],
    verdict: String(parsed.verdict || ""),
    availability: String(parsed.availability || ""),
    intensity,
  };
});

// Polishes a pour's OWN tasting notes/tags into one short, natural paragraph
// -- the opposite job of generateTastingProfile (which invents a plausible
// profile from bottle facts for a bottle with no notes yet). This never adds
// a flavor, aroma, or judgment the user didn't already tag or write; if the
// given notes are too sparse to honestly summarize, it declines via "known".
exports.generateTastingSummary = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to generate a tasting summary.");
  }
  await assertNotRateLimited(request.auth.uid, "generateTastingSummary");

  const { noseAromas, noseNotes, palateFlavors, palateNotes, finishNotes, rating } = request.data || {};
  const aromas = Array.isArray(noseAromas) ? noseAromas.map((a) => String(a)).slice(0, 12) : [];
  const flavors = Array.isArray(palateFlavors) ? palateFlavors.map((f) => String(f)).slice(0, 12) : [];
  const nose = String(noseNotes || "").slice(0, 800).trim();
  const palate = String(palateNotes || "").slice(0, 800).trim();
  const finish = String(finishNotes || "").slice(0, 800).trim();
  const ratingNum = typeof rating === "number" ? rating : null;

  const hasContent = aromas.length > 0 || flavors.length > 0 || Boolean(nose) || Boolean(palate) || Boolean(finish);
  if (!hasContent) return { known: false };

  const system = `You polish a whiskey drinker's own tasting notes into a short, natural reflection (1-3 sentences) for a journaling app called Fully Involved Pour. Reflect ONLY what they actually tagged or wrote -- never introduce a flavor, aroma, descriptor, or judgment they didn't provide, and never add generic tasting-note filler. Write in a warm, knowledgeable second-person voice ("You picked up on..."), like a friend recapping what they noticed, not a formal review. If the given tags/notes are too sparse or contradictory to summarize honestly, set "known" to false. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"known": true or false, "summary": "1-3 sentences, or empty string if not confident"}`;

  const facts = [
    aromas.length > 0 ? `Nose tags: ${aromas.join(", ")}` : null,
    nose ? `Nose notes: ${nose}` : null,
    flavors.length > 0 ? `Palate tags: ${flavors.join(", ")}` : null,
    palate ? `Palate notes: ${palate}` : null,
    finish ? `Finish notes: ${finish}` : null,
    ratingNum != null ? `Rating: ${ratingNum}/10` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt: facts, maxTokens: 300 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse tasting summary JSON", raw);
    return { known: false };
  }

  if (!parsed.known || !parsed.summary) return { known: false };

  return { known: true, summary: String(parsed.summary) };
});

// Interprets a user's own DETERMINISTIC Palate Profile (already computed
// client-side, see features/yourPalate/palateProfile.ts) into a short
// natural-language reflection. Receives only a small, pre-summarized set of
// facts -- never raw bottles/pours -- and must never invent a preference,
// bottle, number, or trend beyond what it's given.
exports.interpretPalateProfile = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to interpret your palate.");
  }
  await assertNotRateLimited(request.auth.uid, "interpretPalateProfile");

  const {
    qualifyingPourCount,
    maturity,
    topCategory,
    topCategoryAverageRating,
    proofBucket,
    proofAverageRating,
    topFlavors,
    mostRepeatedBottleName,
    mostRepeatedPourCount,
  } = request.data || {};

  const flavors = Array.isArray(topFlavors) ? topFlavors.map((f) => String(f)).slice(0, 6) : [];

  const facts = [
    typeof qualifyingPourCount === "number" ? `Qualifying pours logged: ${qualifyingPourCount}` : null,
    maturity ? `Palate maturity stage: ${maturity}` : null,
    topCategory
      ? `Top category: ${topCategory}${typeof topCategoryAverageRating === "number" ? ` (avg ${topCategoryAverageRating}/10)` : ""}`
      : null,
    proofBucket ? `Proof affinity: ${proofBucket}${typeof proofAverageRating === "number" ? ` (avg ${proofAverageRating}/10)` : ""}` : null,
    flavors.length > 0 ? `Top-rated flavor tags: ${flavors.join(", ")}` : null,
    mostRepeatedBottleName ? `Most repeated bottle: ${mostRepeatedBottleName} (${mostRepeatedPourCount} pours)` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (!facts) return { known: false };

  const system = `You interpret a whiskey drinker's own deterministic tasting statistics into a short, warm reflection (1-3 sentences) for a journaling app called Fully Involved Pour. You are given ONLY already-computed facts about their history -- never invent a preference, bottle, number, or trend beyond what's given, and never claim more certainty than the data supports. Speak like a knowledgeable friend, not a report: confident when the data is real, humble when it's thin. Avoid snobbery, marketing language, hedging filler like "As an AI," and excessive jargon. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"known": true or false, "interpretation": "1-3 sentences, or empty string if not confident"}`;

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt: facts, maxTokens: 300 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse palate interpretation JSON", raw);
    return { known: false };
  }

  if (!parsed.known || !parsed.interpretation) return { known: false };

  return { known: true, interpretation: String(parsed.interpretation) };
});

// Explains an already-computed, deterministic Palate Match score (see
// features/palateMatch/scoring.ts) -- the AI never computes or adjusts the
// score itself, only narrates the specific reasons it's given. Called
// on-demand (a "why it fits" expand action), not automatically per view.
exports.explainPalateMatch = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to get a Palate Match explanation.");
  }
  await assertNotRateLimited(request.auth.uid, "explainPalateMatch");

  const { bottleName, score, confidence, reasons } = request.data || {};
  const name = String(bottleName || "").trim();
  const scoreNum = typeof score === "number" ? score : null;
  const reasonList = Array.isArray(reasons) ? reasons.map((r) => String(r)).slice(0, 6) : [];

  if (!name || scoreNum == null || reasonList.length === 0) {
    return { known: false };
  }

  const system = `You explain an already-computed Palate Match score for a whiskey-journaling app called Fully Involved Pour. You are given the score and the specific deterministic reasons behind it -- never invent a reason, fact, or number beyond what's given, and never change, recompute, or contradict the score. Write one short, warm sentence (two at most) explaining why this bottle scored the way it did, grounded only in the given reasons. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"known": true or false, "explanation": "1-2 sentences, or empty string if not confident"}`;

  const facts = [
    `Bottle: ${name}`,
    `Match score: ${scoreNum}%`,
    `Confidence: ${String(confidence || "low")}`,
    `Reasons: ${reasonList.join("; ")}`,
  ].join("\n");

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt: facts, maxTokens: 200 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse palate match explanation JSON", raw);
    return { known: false };
  }

  if (!parsed.known || !parsed.explanation) return { known: false };

  return { known: true, explanation: String(parsed.explanation) };
});

// Narrates an already-chosen "What Should I Pour" recommendation. The AI
// never chooses the bottle -- it only explains the winning candidate's real
// facts and the deterministic reasons/signals it's given. Called only when
// a recommendation is actually revealed, never proactively.
exports.explainPourRecommendation = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to get a pour recommendation explanation.");
  }
  await assertNotRateLimited(request.auth.uid, "explainPourRecommendation");

  const { bottleName, distillery, type, moodLabel, reasons, tags } = request.data || {};
  const name = String(bottleName || "").trim();
  const reasonList = Array.isArray(reasons) ? reasons.map((r) => String(r)).slice(0, 6) : [];
  const tagList = Array.isArray(tags) ? tags.map((t) => String(t)).slice(0, 6) : [];

  if (!name || reasonList.length === 0) {
    return { known: false };
  }

  const system = `You explain an already-chosen "what should I pour tonight" recommendation for a whiskey-journaling app called Fully Involved Pour. You are given the bottle, the mood the drinker picked, and the specific deterministic reasons this bottle was chosen -- never invent a reason, fact, or bottle detail beyond what's given, and never suggest a different bottle. Write one short, warm paragraph (2-3 sentences) explaining why this pour fits tonight. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"known": true or false, "explanation": "2-3 sentences, or empty string if not confident"}`;

  const facts = [
    `Bottle: ${name}`,
    distillery ? `Distillery: ${distillery}` : null,
    type ? `Type: ${type}` : null,
    moodLabel ? `Mood: ${moodLabel}` : null,
    `Reasons: ${reasonList.join("; ")}`,
    tagList.length > 0 ? `Signals: ${tagList.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt: facts, maxTokens: 250 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse pour recommendation explanation JSON", raw);
    return { known: false };
  }

  if (!parsed.known || !parsed.explanation) return { known: false };

  return { known: true, explanation: String(parsed.explanation) };
});

exports.scanBottleLabel = onCall(
  { secrets: [anthropicApiKey], cors: true, memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to scan bottle labels.");
    }

    const imageBase64 = String(request.data?.imageBase64 || "");
    const mediaType = String(request.data?.mediaType || "image/jpeg");
    if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
      throw new HttpsError("invalid-argument", "Unsupported image type.");
    }
    if (imageBase64.length < 100) {
      throw new HttpsError("invalid-argument", "A label photo is required.");
    }
    if (imageBase64.length > 7000000) {
      throw new HttpsError("invalid-argument", "Photo is too large. Try a smaller photo.");
    }

    const system = `You identify whiskey and spirits bottles from photos. The photo may show a full bottle, a partial label, a bottle on a shelf, or a close-up -- work with whatever is visible. Combine what you can read on the label with your knowledge of well-known bottles to fill in the details. Do not invent details for bottles you cannot identify. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"found": true or false, "name": "full bottle/expression name", "distillery": "producer or distillery", "type": "Bourbon|Rye|Scotch|Irish|Tequila|Rum|Other Spirit", "region": "state or country if determinable", "proof": number or 0, "ageStatement": "e.g. 10 Year or empty string", "msrp": typical retail price in USD as a number or 0}
Set "found" to false ONLY if no spirits bottle is visible in the image at all. If a bottle is visible but some details are unreadable or unknown, still set "found" to true, fill in what you can, and leave unknown text fields as empty strings and unknown numbers as 0. For msrp, only include it if this is a well-known bottle whose typical retail price you know; otherwise 0.`;

    const raw = await callClaude(anthropicApiKey.value(), {
      system,
      maxTokens: 300,
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: imageBase64 },
        },
        { type: "text", text: "Extract the bottle details from this label photo." },
      ],
    });

    let parsed;
    try {
      parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
    } catch (error) {
      console.error("Failed to parse label scan JSON", raw);
      return { found: false };
    }

    console.log("Label scan result", JSON.stringify({ imageKb: Math.round(imageBase64.length / 1365), ...parsed }));

    if (!parsed.found) return { found: false };

    return {
      found: true,
      name: String(parsed.name || ""),
      distillery: String(parsed.distillery || ""),
      type: String(parsed.type || ""),
      region: String(parsed.region || ""),
      proof: Number(parsed.proof || 0),
      ageStatement: String(parsed.ageStatement || ""),
      msrp: Number(parsed.msrp || 0),
    };
  },
);

exports.recommendBottles = onCall({ secrets: [anthropicApiKey], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to get AI recommendations.");
  }

  const collectionSummary = String(request.data?.collectionSummary || "").slice(0, 4000);
  if (!collectionSummary.trim()) {
    throw new HttpsError("invalid-argument", "A collection summary is required.");
  }

  const system = `You are a whiskey/spirits sommelier recommending bottles for someone to try next, based on their existing collection. Only recommend real, well-known, currently-produced bottles you are confident actually exist -- never invent a bottle name. Never recommend a bottle that is already listed in their collection below. Tie each recommendation to something specific about their taste (distilleries, types, or ratings they already have). Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"recommendations": [{"name": "...", "distillery": "...", "type": "Bourbon|Rye|Scotch|Irish|Tequila|Rum|Other Spirit", "reason": "one concise sentence"}]}
Return 3 to 5 recommendations. If their collection is too sparse or generic to infer real taste, return an empty array rather than guessing.`;

  const prompt = `Their current collection:\n${collectionSummary}\n\nRecommend bottles for them to try next.`;

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt, maxTokens: 500 });

  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch (error) {
    console.error("Failed to parse recommendation JSON", raw);
    return { recommendations: [] };
  }

  const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  return {
    recommendations: recommendations.slice(0, 5).map((rec) => ({
      name: String(rec.name || ""),
      distillery: String(rec.distillery || ""),
      type: String(rec.type || ""),
      reason: String(rec.reason || ""),
    })).filter((rec) => rec.name),
  };
});

// Server-side background removal so the clean cutout works on any device (incl. iOS,
// where the in-browser model stalls). Runs the open-source model bundled with the
// package — no external API, no per-image cost. Lazy-required so it only weighs on
// this function's cold start, not the AI ones.
let removeBackgroundFn;
function getRemoveBackground() {
  if (!removeBackgroundFn) {
    ({ removeBackground: removeBackgroundFn } = require("@imgly/background-removal-node"));
  }
  return removeBackgroundFn;
}

exports.removeBottleBackground = onCall(
  { memory: "2GiB", timeoutSeconds: 120, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to clean up bottle photos.");
    }
    const imageBase64 = String(request.data?.imageBase64 || "");
    if (!imageBase64) {
      throw new HttpsError("invalid-argument", "An image is required.");
    }
    try {
      const removeBackground = getRemoveBackground();
      const inputBuffer = Buffer.from(imageBase64, "base64");
      const inputBlob = new Blob([inputBuffer], { type: "image/jpeg" });
      const outBlob = await removeBackground(inputBlob, { output: { format: "image/png" } });
      const outBuffer = Buffer.from(await outBlob.arrayBuffer());
      return { imageBase64: outBuffer.toString("base64") };
    } catch (error) {
      console.error("Background removal failed", error);
      throw new HttpsError("internal", "Could not remove the background from that photo.");
    }
  },
);

