const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

async function callClaude(apiKey, { system, prompt, maxTokens }) {
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
      messages: [{ role: "user", content: prompt }],
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

  const system = `${SOMMELIER_PERSONA}\n\nHere is a summary of their current collection:\n${collectionSummary || "(their collection is empty so far)"}`;
  const reply = await callClaude(anthropicApiKey.value(), { system, prompt, maxTokens: 400 });
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

  const system = `You are a whiskey/spirits database expert. Given a bottle name, identify its real-world distillery, spirit type, region, and typical bottled proof, ONLY if you genuinely recognize this as a real, existing product. If you do not recognize the bottle or are not confident, set "known" to false and leave the other fields empty -- never invent or guess plausible-sounding but unverified details. Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:\n{"known": true or false, "distillery": "...", "type": "Bourbon|Rye|Scotch|Irish|Tequila|Rum|Other Spirit", "region": "...", "proof": number or 0}`;

  const prompt = `Bottle name: ${bottleName}`;

  const raw = await callClaude(anthropicApiKey.value(), { system, prompt, maxTokens: 200 });

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
