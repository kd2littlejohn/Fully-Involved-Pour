// Shared prompt + result guard for identifying a bottle from a barcode.
// Used by every provider (providers/claude.js, providers/gemini.js) so the
// Claude-vs-Gemini comparison measures the models, not two different
// prompts.
//
// The guard below is the part that matters for "never fabricate": whatever
// the model says, a result only counts as identified when it names a real
// product AND cites at least one web source, and a proof is only kept for a
// product line bottled at one fixed proof. A UPC identifies a product line
// and size — never a batch, barrel, store pick or the proof of one bottle.

const CATEGORIES = ["Bourbon", "Rye", "Scotch", "Irish", "Tequila", "Rum", "Other Spirit"];

const SYSTEM_PROMPT = `You identify retail whiskey and spirits products from their barcode (UPC/EAN/GTIN) for a bottle-collection app.

Rules:
- Search the web for the exact barcode number. Only identify the product when a source you found ties THIS barcode number to the product. Never infer a product from the manufacturer prefix alone.
- A barcode identifies a product line and bottle size only. It never identifies a batch, barrel number, store pick, release year or the proof of one particular bottle. Never report any of those.
- Report "proof" only when the product is always bottled at one fixed proof. For barrel proof, cask strength, single barrel, batch-numbered or store-pick products, set "proof" to null and "proofVaries" to true.
- Set "upcSharedAcrossVariants" to true when the same barcode is known or likely to be used for several variants (single barrels, store picks, batches, annual releases).
- Leave any field you could not confirm from a source as null. Do not guess.
- If no source ties the barcode to a product, set "identified" to false.

Respond with ONLY one JSON object, no markdown fences, no commentary:
{"identified": true|false, "name": "full product name"|null, "distillery": "producer or distillery"|null, "brand": "brand"|null, "expression": "expression"|null, "category": ${CATEGORIES.map((c) => `"${c}"`).join("|")}|null, "sizeMl": number|null, "proof": number|null, "proofVaries": true|false, "ageStatement": "e.g. 10 Year"|null, "upcSharedAcrossVariants": true|false, "confidence": "low"|"medium"|"high", "sources": [{"url": "...", "title": "..."}], "notes": "one short sentence"|null}`;

function upcPrompt(normalized) {
  const forms = [normalized.upcA && `UPC-A ${normalized.upcA}`, `EAN-13/GTIN-13 ${normalized.gtin13}`].filter(Boolean);
  return `Identify the spirits product with barcode ${forms.join(" (also written as ")}${forms.length > 1 ? ")" : ""}.`;
}

const PHOTO_PROMPT =
  "This photo shows the barcode area of a spirits bottle. Read the barcode digits and any visible label text, then identify the product following the rules. Only use the label text to confirm a product your sources tie to the barcode number.";

function extractJson(raw) {
  const text = String(raw || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function cleanText(value, max = 200) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function cleanNumber(value, min, max) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function cleanSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((s) => ({ url: cleanText(s?.url, 500), title: cleanText(s?.title, 200) }))
    .filter((s) => s.url && /^https?:\/\//.test(s.url))
    .slice(0, 5);
}

const NOT_IDENTIFIED = Object.freeze({
  identified: false,
  name: null,
  distillery: null,
  brand: null,
  expression: null,
  category: null,
  sizeMl: null,
  proof: null,
  proofVaries: false,
  ageStatement: null,
  upcSharedAcrossVariants: false,
  confidence: "low",
  sources: [],
  notes: null,
});

// `groundingSources` are the URLs the provider itself reports it searched
// (Claude web_search results / Gemini grounding chunks). They count as
// sources even when the model forgets to copy them into its JSON.
function guardResult(parsed, groundingSources = []) {
  if (!parsed || typeof parsed !== "object") return { ...NOT_IDENTIFIED, guard: "unparseable" };
  const sources = cleanSources(parsed.sources);
  const allSources = sources.length > 0 ? sources : cleanSources(groundingSources);
  const name = cleanText(parsed.name);

  if (parsed.identified !== true || !name) return { ...NOT_IDENTIFIED, sources: allSources, guard: "model-not-identified" };
  if (allSources.length === 0) return { ...NOT_IDENTIFIED, guard: "no-source" };

  const proofVaries = parsed.proofVaries === true;
  const upcSharedAcrossVariants = parsed.upcSharedAcrossVariants === true;
  return {
    identified: true,
    name,
    distillery: cleanText(parsed.distillery),
    brand: cleanText(parsed.brand),
    expression: cleanText(parsed.expression),
    category: CATEGORIES.includes(parsed.category) ? parsed.category : null,
    sizeMl: cleanNumber(parsed.sizeMl, 50, 4500),
    // A proof is a fact about the product line only when it never varies.
    proof: proofVaries || upcSharedAcrossVariants ? null : cleanNumber(parsed.proof, 40, 200),
    proofVaries,
    ageStatement: cleanText(parsed.ageStatement, 60),
    upcSharedAcrossVariants,
    confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
    sources: allSources,
    notes: cleanText(parsed.notes, 300),
    guard: "ok",
  };
}

module.exports = { SYSTEM_PROMPT, PHOTO_PROMPT, upcPrompt, extractJson, guardResult, NOT_IDENTIFIED, CATEGORIES };
