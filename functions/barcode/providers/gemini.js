// Gemini + Grounding with Google Search for an unknown barcode — proof of
// concept comparison only. NOT wired into any Cloud Function: it runs only
// from scripts/barcodePoc.mjs, and only when GEMINI_API_KEY is set, so
// nothing here enables or bills a Google service until the owner approves
// it and supplies a key.
//
// Calls the Gemini Developer API REST endpoint — the same models and
// grounding pricing that Firebase AI Logic's "Gemini Developer API" backend
// uses — so results carry over to a Firebase AI Logic integration.
//
// Google's terms for grounded results (display the Search Suggestions
// returned in groundingMetadata.searchEntryPoint; limits on storing grounded
// results) apply to any production use. See docs/BARCODE_POC.md.

const { SYSTEM_PROMPT, LABEL_SYSTEM_PROMPT, PHOTO_PROMPT, upcPrompt, labelPrompt, extractJson, guardResult } = require("../identify");
const { geminiCost } = require("../pricing");

const DEFAULT_GEMINI_MODEL = "gemini-3-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Same three modes as providers/claude.js.
function buildRequest(mode, normalized, photo) {
  const image = photo && { inlineData: { mimeType: photo.mediaType, data: photo.base64 } };
  if (mode === "label") return { system: LABEL_SYSTEM_PROMPT, parts: [image, { text: labelPrompt(normalized) }] };
  if (mode === "photo") return { system: SYSTEM_PROMPT, parts: [image, { text: PHOTO_PROMPT }] };
  return { system: SYSTEM_PROMPT, parts: [{ text: upcPrompt(normalized) }] };
}

async function listGeminiModels(apiKey) {
  const response = await fetch(`${API_BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey } });
  if (!response.ok) throw new Error(`Gemini API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  return (data.models || []).map((m) => m.name.replace(/^models\//, ""));
}

async function identifyWithGemini({ apiKey, model = DEFAULT_GEMINI_MODEL, normalized, photo, mode = photo ? "photo" : "upc", thinkingLevel = "low" }) {
  const started = Date.now();
  const request = buildRequest(mode, normalized, photo);
  const response = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: request.parts }],
      tools: [{ google_search: {} }],
      generationConfig: { thinkingConfig: { thinkingLevel } },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((p) => p.text || "").join("");
  const grounding = candidate?.groundingMetadata || {};
  const groundingSources = (grounding.groundingChunks || [])
    .filter((chunk) => chunk.web?.uri)
    .map((chunk) => ({ url: chunk.web.uri, title: chunk.web.title }));
  const searchQueries = (grounding.webSearchQueries || []).length;
  const raw = extractJson(text);

  return {
    provider: "gemini",
    model,
    mode,
    result: guardResult(raw, groundingSources, { labelPhoto: mode === "label" }),
    raw,
    latencyMs: Date.now() - started,
    stopReason: candidate?.finishReason || null,
    usage: { ...data.usageMetadata, webSearchQueries: searchQueries },
    cost: geminiCost(model, data.usageMetadata, searchQueries),
    // Must be shown wherever a grounded answer is displayed in production.
    hasSearchEntryPoint: Boolean(grounding.searchEntryPoint?.renderedContent),
  };
}

module.exports = { identifyWithGemini, listGeminiModels, DEFAULT_GEMINI_MODEL };
