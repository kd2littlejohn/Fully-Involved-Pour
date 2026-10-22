// Gemini + Grounding with Google Search: Scan Barcode's first external
// lookup for a barcode FIP's catalog doesn't know (lookup.js), and the
// Gemini side of the Claude-vs-Gemini comparison (scripts/barcode-poc.js).
//
// Calls the Gemini Developer API REST endpoint with the key from the
// GEMINI_API_KEY Functions secret; the key never reaches a client.
//
// Google's terms for grounded results apply wherever this is shown (see
// docs/BARCODE_POC.md → "Google terms"): the Search Suggestions returned in
// groundingMetadata.searchEntryPoint must be displayed with the result, to
// the user who asked; grounded results are not cached, stored or used to
// build FIP's catalog.

const { SYSTEM_PROMPT, LABEL_SYSTEM_PROMPT, PHOTO_PROMPT, upcPrompt, labelPrompt, extractJson, guardResult } = require("../identify");
const { geminiCost } = require("../pricing");

const DEFAULT_GEMINI_MODEL = "gemini-3-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 25000;

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

// Grounding sources as Google returns them (redirect links + site titles).
// Only these count as evidence, and they are what the app shows.
function groundingSourcesOf(grounding) {
  return (grounding.groundingChunks || [])
    .filter((chunk) => chunk.web?.uri)
    .map((chunk) => ({ url: chunk.web.uri, title: chunk.web.title || chunk.web.domain || null }));
}

async function identifyWithGemini({
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  normalized,
  photo,
  mode = photo ? "photo" : "upc",
  thinkingLevel = "low",
  fetchImpl = fetch,
}) {
  const started = Date.now();
  const request = buildRequest(mode, normalized, photo);
  const response = await fetchImpl(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
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
  const text = (candidate?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  const grounding = candidate?.groundingMetadata || {};
  const groundingSources = groundingSourcesOf(grounding);
  const searchQueries = (grounding.webSearchQueries || []).length;
  const raw = extractJson(text);
  const result = guardResult(raw, groundingSources, { labelPhoto: mode === "label", groundingOnly: true });
  // An answer Google grounded must be shown with its Search Suggestions; one
  // without them is not shown at all.
  const searchEntryPoint = grounding.searchEntryPoint?.renderedContent || null;
  if (result.identified && !searchEntryPoint) {
    result.identified = false;
    result.candidates = [];
    result.guard = "no-search-suggestions";
  }

  return {
    provider: "gemini",
    model,
    mode,
    result,
    searchEntryPoint,
    raw,
    latencyMs: Date.now() - started,
    stopReason: candidate?.finishReason || null,
    usage: { ...data.usageMetadata, webSearchQueries: searchQueries },
    cost: geminiCost(model, data.usageMetadata, searchQueries),
    hasSearchEntryPoint: Boolean(searchEntryPoint),
  };
}

module.exports = { identifyWithGemini, listGeminiModels, groundingSourcesOf, DEFAULT_GEMINI_MODEL };
