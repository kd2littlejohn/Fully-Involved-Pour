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

// Preferred models, cheapest first. Google renames and retires Flash models
// (gemini-3-flash-preview → gemini-3.5-flash …), so the model actually used
// is the first of these the key can call, checked against Google's model
// list at runtime (resolveGeminiModel) rather than assumed.
const PREFERRED_GEMINI_MODELS = ["gemini-3-flash", "gemini-3-flash-preview", "gemini-3.5-flash", "gemini-3.6-flash"];
const DEFAULT_GEMINI_MODEL = PREFERRED_GEMINI_MODELS[0];
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 25000;
const MODEL_LIST_TTL_MS = 60 * 60 * 1000;

// A Gemini call that failed, with a short, user-safe reason the app can
// show ("quota", "auth", …) next to the provider's own message for logs.
class GeminiError extends Error {
  constructor(reason, status, detail) {
    super(`Gemini API error ${status}: ${detail}`);
    this.name = "GeminiError";
    this.reason = reason;
    this.status = status;
  }
}

function classifyFailure(status, body) {
  const text = String(body || "");
  if (status === 404 || /NOT_FOUND|is not found for API version|not supported for generateContent/i.test(text)) return "model-unavailable";
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|SERVICE_DISABLED/i.test(text)) return "auth";
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|spending cap/i.test(text)) return "quota";
  if (status >= 500) return "unavailable";
  return "bad-request";
}

async function failure(response) {
  const body = await response.text().catch(() => "");
  return new GeminiError(classifyFailure(response.status, body), response.status, body.slice(0, 300));
}

// Same three modes as providers/claude.js.
function buildRequest(mode, normalized, photo) {
  const image = photo && { inlineData: { mimeType: photo.mediaType, data: photo.base64 } };
  if (mode === "label") return { system: LABEL_SYSTEM_PROMPT, parts: [image, { text: labelPrompt(normalized) }] };
  if (mode === "photo") return { system: SYSTEM_PROMPT, parts: [image, { text: PHOTO_PROMPT }] };
  return { system: SYSTEM_PROMPT, parts: [{ text: upcPrompt(normalized) }] };
}

async function listGeminiModels(apiKey, { fetchImpl = fetch, generateContentOnly = false } = {}) {
  const response = await fetchImpl(`${API_BASE}/models?pageSize=1000`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw await failure(response);
  const data = await response.json();
  return (data.models || [])
    .filter((m) => !generateContentOnly || (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}

let modelListCache = null;

function resetGeminiModelCache() {
  modelListCache = null;
}

// The first of [configured, ...PREFERRED_GEMINI_MODELS] this key can call.
// Google's model list is free to read; it's cached for an hour per
// function instance. If the list can't be read, the first choice is tried
// as is (a bad key then fails with a clear "auth" reason on the call).
async function resolveGeminiModel(apiKey, configured, { fetchImpl = fetch, now = Date.now } = {}) {
  const choices = [...new Set([configured, ...PREFERRED_GEMINI_MODELS].filter(Boolean))];
  if (!modelListCache || modelListCache.apiKey !== apiKey || now() - modelListCache.at > MODEL_LIST_TTL_MS) {
    try {
      modelListCache = { apiKey, at: now(), models: new Set(await listGeminiModels(apiKey, { fetchImpl, generateContentOnly: true })) };
    } catch (error) {
      if (error instanceof GeminiError && error.reason === "auth") throw error;
      return choices[0];
    }
  }
  const usable = choices.find((m) => modelListCache.models.has(m));
  if (!usable) {
    // Fall back to any Gemini Flash model the key offers, newest-looking first.
    const flash = [...modelListCache.models].filter((m) => /^gemini-[\d.]+-flash(-preview)?$/.test(m)).sort().reverse();
    if (flash.length > 0) return flash[0];
    throw new GeminiError("model-unavailable", 404, `none of ${choices.join(", ")} is available to this key`);
  }
  return usable;
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
  if (!response.ok) throw await failure(response);
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

module.exports = {
  identifyWithGemini,
  listGeminiModels,
  resolveGeminiModel,
  resetGeminiModelCache,
  groundingSourcesOf,
  classifyFailure,
  GeminiError,
  DEFAULT_GEMINI_MODEL,
  PREFERRED_GEMINI_MODELS,
};
