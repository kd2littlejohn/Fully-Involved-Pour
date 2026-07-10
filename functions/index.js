const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

async function callClaude(apiKey, { system, prompt, maxTokens, content }) {
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
      messages: [{ role: "user", content: content || prompt }],
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
