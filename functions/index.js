const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

// Instagram OAuth app credentials (Meta app). The client only ever sees the id;
// the secret stays here. Configure with:
//   firebase functions:secrets:set INSTAGRAM_APP_ID
//   firebase functions:secrets:set INSTAGRAM_APP_SECRET
const instagramAppId = defineSecret("INSTAGRAM_APP_ID");
const instagramAppSecret = defineSecret("INSTAGRAM_APP_SECRET");

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

// Instagram has no native Firebase provider, so we run the OAuth code exchange
// ourselves and mint a Firebase custom token the client signs in with. The
// browser sends the authorization code from the redirect; we swap it for the
// user's Instagram id + username and return a token bound to a stable uid.
exports.exchangeInstagramCode = onCall(
  { secrets: [instagramAppId, instagramAppSecret], cors: true },
  async (request) => {
    const code = String(request.data?.code || "").trim();
    const redirectUri = String(request.data?.redirectUri || "").trim();
    if (!code || !redirectUri) {
      throw new HttpsError("invalid-argument", "Missing Instagram authorization code.");
    }

    const appId = instagramAppId.value();
    const appSecret = instagramAppSecret.value();
    if (!appId || !appSecret) {
      throw new HttpsError("failed-precondition", "Instagram sign-in isn't configured on the server.");
    }

    // 1) Exchange the one-time code for a short-lived access token + user id.
    let tokenData;
    try {
      const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }).toString(),
      });
      if (!tokenRes.ok) {
        console.error("Instagram token exchange failed", tokenRes.status, await tokenRes.text());
        throw new HttpsError("permission-denied", "Instagram rejected the sign-in. Please try again.");
      }
      tokenData = await tokenRes.json();
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("Instagram token request error", error);
      throw new HttpsError("unavailable", "Could not reach Instagram. Please try again.");
    }

    const accessToken = String(tokenData.access_token || "");
    let igId = tokenData.user_id ? String(tokenData.user_id) : "";
    let username = "";

    // 2) Read the profile (id + username) with the access token.
    if (accessToken) {
      try {
        const profRes = await fetch(
          `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`,
        );
        if (profRes.ok) {
          const prof = await profRes.json();
          igId = String(prof.id || igId);
          username = String(prof.username || "");
        } else {
          console.warn("Instagram profile fetch non-OK", profRes.status);
        }
      } catch (error) {
        console.warn("Instagram profile fetch failed", error);
      }
    }

    if (!igId) {
      throw new HttpsError("internal", "Could not read your Instagram account.");
    }

    const uid = `instagram:${igId}`;
    const displayName = username ? `@${username}` : "Instagram user";

    // 3) Upsert a stable Firebase user for this Instagram account.
    try {
      await admin.auth().updateUser(uid, { displayName });
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        await admin.auth().createUser({ uid, displayName });
      } else {
        console.error("Instagram user upsert failed", error);
        throw new HttpsError("internal", "Could not set up your account.");
      }
    }

    // 4) Mint the custom token the client exchanges for a session.
    const token = await admin.auth().createCustomToken(uid, {
      provider: "instagram",
      igUsername: username,
    });
    return { token, username };
  },
);
