// List prices used to turn each provider call's reported usage into an
// estimated cost for the Scan Barcode proof of concept. Estimates only —
// the provider's billing console is the source of truth. Re-check before
// budgeting; `checked` records when and where each figure came from.

const PRICES = {
  // Anthropic first-party API, per 1M tokens. Web search: $10 per 1,000
  // searches, plus the tokens of the results it returns.
  claude: {
    checked: "2026-10-22, Anthropic pricing (claude-api skill table cached 2026-10-06)",
    webSearchPerSearch: 10 / 1000,
    models: {
      "claude-opus-5-5": { input: 4, output: 20 },
      "claude-sonnet-5-5": { input: 2, output: 10 },
      "claude-sonnet-4-6": { input: 3, output: 15 },
      "claude-haiku-5-5": { input: 0.1, output: 0.5 },
    },
  },
  // Gemini Developer API, per 1M tokens. NOT verified against Google's own
  // pricing page (unreachable from the build environment) — figures agree
  // across several third-party trackers. Grounding on Gemini 3 models: 5,000
  // search queries per month free (shared across Gemini 3 models), then
  // $14 per 1,000 search queries; one prompt can run several queries.
  gemini: {
    checked: "2026-10-22, third-party trackers only — verify on ai.google.dev/gemini-api/docs/pricing",
    groundingPerQueryAfterFreeTier: 14 / 1000,
    groundingFreeQueriesPerMonth: 5000,
    models: {
      "gemini-3-flash": { input: 0.5, output: 3 },
      "gemini-3-flash-preview": { input: 0.5, output: 3 },
      "gemini-3.5-flash": { input: 1.5, output: 9 },
    },
  },
};

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

function claudeCost(model, usage) {
  const price = PRICES.claude.models[model];
  if (!price || !usage) return null;
  const input =
    (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1;
  const searches = usage.server_tool_use?.web_search_requests || 0;
  const tokens = (input * price.input + (usage.output_tokens || 0) * price.output) / 1e6;
  return { tokens: round(tokens), search: round(searches * PRICES.claude.webSearchPerSearch), total: round(tokens + searches * PRICES.claude.webSearchPerSearch), searches };
}

// `searchQueries` comes from groundingMetadata.webSearchQueries. `search`
// is the marginal cost once the monthly free allowance is used up; inside
// the allowance the search part is $0.
function geminiCost(model, usageMetadata, searchQueries) {
  const price = PRICES.gemini.models[model];
  if (!price || !usageMetadata) return null;
  const input = (usageMetadata.promptTokenCount || 0) + (usageMetadata.toolUsePromptTokenCount || 0);
  const output = (usageMetadata.candidatesTokenCount || 0) + (usageMetadata.thoughtsTokenCount || 0);
  const tokens = (input * price.input + output * price.output) / 1e6;
  const search = searchQueries * PRICES.gemini.groundingPerQueryAfterFreeTier;
  return { tokens: round(tokens), search: round(search), total: round(tokens + search), searches: searchQueries };
}

module.exports = { PRICES, claudeCost, geminiCost };
