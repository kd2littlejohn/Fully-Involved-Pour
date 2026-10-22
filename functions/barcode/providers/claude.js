// Claude + web search for an unknown barcode. Raw fetch, like callClaude in
// index.js, but it needs the whole response (search results, usage, stop
// reason), not just the first text block.

const { SYSTEM_PROMPT, PHOTO_PROMPT, upcPrompt, extractJson, guardResult } = require("../identify");
const { claudeCost } = require("../pricing");

const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";
const MAX_SEARCHES = 3;
const MAX_CONTINUATIONS = 2;
// Models that accept the server-side refusal fallback in its "default" form.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

function buildContent(normalized, photo) {
  if (!photo) return [{ type: "text", text: upcPrompt(normalized) }];
  return [
    { type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.base64 } },
    { type: "text", text: normalized ? `${PHOTO_PROMPT} The decoded barcode is ${normalized.gtin13}.` : PHOTO_PROMPT },
  ];
}

function addUsage(total, usage) {
  if (!usage) return total;
  return {
    input_tokens: (total.input_tokens || 0) + (usage.input_tokens || 0),
    output_tokens: (total.output_tokens || 0) + (usage.output_tokens || 0),
    cache_creation_input_tokens: (total.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0),
    cache_read_input_tokens: (total.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
    server_tool_use: {
      web_search_requests: (total.server_tool_use?.web_search_requests || 0) + (usage.server_tool_use?.web_search_requests || 0),
    },
  };
}

// `normalized` is gtin.normalizeBarcode output (may be null in photo-only
// mode); `photo` is { base64, mediaType } for the barcode-photo test.
async function identifyWithClaude({ apiKey, model = DEFAULT_CLAUDE_MODEL, normalized, photo, effort = "low" }) {
  const started = Date.now();
  const headers = { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  const body = {
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: { effort },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES }],
    messages: [{ role: "user", content: buildContent(normalized, photo) }],
  };
  if (FALLBACK_MODELS.has(model)) {
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    body.fallbacks = "default";
  }

  let usage = {};
  let content = [];
  let stopReason = null;
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorText.slice(0, 300)}`);
    }
    const data = await response.json();
    usage = addUsage(usage, data.usage);
    content = [...content, ...(data.content || [])];
    stopReason = data.stop_reason;
    // A long server-tool turn can pause; resend with what we have so far.
    if (stopReason !== "pause_turn") break;
    body.messages = [body.messages[0], { role: "assistant", content }];
  }

  const groundingSources = content
    .filter((block) => block.type === "web_search_tool_result" && Array.isArray(block.content))
    .flatMap((block) => block.content.map((r) => ({ url: r.url, title: r.title })));
  const lastToolIndex = content.map((b) => b.type).lastIndexOf("web_search_tool_result");
  const text = content
    .slice(lastToolIndex + 1)
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const raw = stopReason === "refusal" ? null : extractJson(text);
  const result = guardResult(raw, groundingSources);
  return {
    provider: "claude",
    model,
    result,
    raw,
    latencyMs: Date.now() - started,
    stopReason,
    usage,
    cost: claudeCost(model, usage),
  };
}

module.exports = { identifyWithClaude, DEFAULT_CLAUDE_MODEL };
