// Shared prompt + result guard for identifying a bottle from a barcode
// and/or a front-label photo. Used by every provider (providers/claude.js,
// providers/gemini.js) so the Claude-vs-Gemini comparison measures the
// models, not two different prompts.
//
// A UPC identifies a product line and size, not one exact bottle: batches,
// single barrels and store picks usually share it. So the model returns a
// product line plus a short list of candidate releases, and the guard below
// enforces, whatever the model says:
//   - an identification counts only if it cites at least one web source
//     (or, for a label photo, the label itself was read);
//   - candidates never carry batch or barrel numbers — those only ever come
//     from an administrator-verified catalog entry or the user's own label;
//   - a proof is kept only for a standard release bottled at one fixed
//     proof. Proof printed on the user's own label is reported separately,
//     as something read from their bottle, never as catalog fact.

const CATEGORIES = ["Bourbon", "Rye", "Scotch", "Irish", "Tequila", "Rum", "Other Spirit"];
const RELEASE_KINDS = ["standard", "barrel-proof-batch", "single-barrel", "store-pick", "limited-release"];
const MAX_CANDIDATES = 6;

const RULES = `Rules:
- A barcode identifies a product line and bottle size only. Several releases often share one barcode: barrel-proof batches, single barrels, store picks, annual or limited releases. List each plausible release as a separate candidate, most likely first.
- Never report a batch number, barrel number, store-pick name or release year as a fact about the user's bottle.
- Give "proof" only for a "standard" release always bottled at one fixed proof. For every other release kind set "proof" to null and "proofVaries" to true.
- Leave any field you could not confirm as null. Do not guess.`;

const SCHEMA = `{"identified": true|false, "productLine": {"name": "product line name"|null, "distillery": "producer or distillery"|null, "brand": "brand"|null, "category": ${CATEGORIES.map((c) => `"${c}"`).join("|")}|null, "sizeMl": number|null}, "upcSharedAcrossVariants": true|false, "candidates": [{"name": "full release name", "expression": "expression"|null, "releaseKind": ${RELEASE_KINDS.map((k) => `"${k}"`).join("|")}, "proof": number|null, "proofVaries": true|false, "ageStatement": "e.g. 10 Year"|null, "notes": "how to tell this release apart"|null}], "confidence": "low"|"medium"|"high", "sources": [{"url": "...", "title": "..."}], "notes": "one short sentence"|null`;

const SYSTEM_PROMPT = `You identify retail whiskey and spirits products from their barcode (UPC/EAN/GTIN) for a bottle-collection app.

- Search the web for the exact barcode number. Only identify the product when a source you found ties THIS barcode number to the product. Never infer a product from the manufacturer prefix alone.
- If no source ties the barcode to a product, set "identified" to false.
${RULES}

Respond with ONLY one JSON object, no markdown fences, no commentary:
${SCHEMA}}`;

const LABEL_SYSTEM_PROMPT = `You identify a whiskey or spirits bottle from a photo of its front label, plus its barcode number when one is given, for a bottle-collection app.

- First read the label exactly as printed. Report only text you can actually see in "label"; use null for anything not visible.
- Then identify the product. When a barcode is given, search the web for it and prefer releases that sources tie to that barcode AND that match the label.
- "identified" may be true from the label alone when the product name is clearly printed; cite sources when you used any.
${RULES}
- Batch, barrel, proof, store-pick or age details printed on THIS label go only in "label", never in "candidates".

Respond with ONLY one JSON object, no markdown fences, no commentary:
${SCHEMA}, "label": {"name": "product name as printed"|null, "distillery": "as printed"|null, "proof": number|null, "abv": number|null, "batch": "as printed"|null, "barrel": "as printed"|null, "storePick": "store or club named as the selector"|null, "ageStatement": "as printed"|null, "sizeMl": number|null}}`;

function upcPrompt(normalized) {
  const forms = [normalized.upcA && `UPC-A ${normalized.upcA}`, `EAN-13/GTIN-13 ${normalized.gtin13}`].filter(Boolean);
  return `Identify the spirits product with barcode ${forms.join(" (also written as ")}${forms.length > 1 ? ")" : ""}.`;
}

function labelPrompt(normalized) {
  return normalized
    ? `Front label photo above. Its barcode is ${normalized.upcA ? `UPC-A ${normalized.upcA} / ` : ""}GTIN-13 ${normalized.gtin13}.`
    : "Front label photo above. No barcode was scanned.";
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
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function cleanSources(sources) {
  if (!Array.isArray(sources)) return [];
  const seen = new Set();
  return sources
    .map((s) => ({ url: cleanText(s?.url, 500), title: cleanText(s?.title, 200) }))
    .filter((s) => s.url && /^https?:\/\//.test(s.url) && !seen.has(s.url) && seen.add(s.url))
    .slice(0, 5);
}

function cleanCandidate(c, productLine, index) {
  const name = cleanText(c?.name) || (index === 0 ? productLine.name : null);
  if (!name) return null;
  const releaseKind = RELEASE_KINDS.includes(c?.releaseKind) ? c.releaseKind : "standard";
  const proofVaries = c?.proofVaries === true || releaseKind !== "standard";
  return {
    id: `axe-${index + 1}`,
    name,
    distillery: productLine.distillery,
    brand: productLine.brand,
    expression: cleanText(c?.expression),
    category: productLine.category,
    sizeMl: productLine.sizeMl,
    releaseKind,
    // A proof is a fact about the release only when it never varies.
    proof: proofVaries ? null : cleanNumber(c?.proof, 40, 200),
    proofVaries,
    ageStatement: cleanText(c?.ageStatement, 60),
    notes: cleanText(c?.notes, 300),
  };
}

function cleanLabel(label) {
  if (!label || typeof label !== "object") return null;
  const abv = cleanNumber(label.abv, 20, 100);
  const reading = {
    name: cleanText(label.name),
    distillery: cleanText(label.distillery),
    // Proof printed on the label, or derived from a printed ABV.
    proof: cleanNumber(label.proof, 40, 200) ?? (abv ? Math.round(abv * 20) / 10 : null),
    batch: cleanText(label.batch, 60),
    barrel: cleanText(label.barrel, 60),
    storePick: cleanText(label.storePick, 120),
    ageStatement: cleanText(label.ageStatement, 60),
    sizeMl: cleanNumber(label.sizeMl, 50, 4500),
  };
  return Object.values(reading).some((v) => v !== null) ? reading : null;
}

const NOT_IDENTIFIED = Object.freeze({
  identified: false,
  productLine: null,
  upcSharedAcrossVariants: false,
  candidates: [],
  confidence: "low",
  sources: [],
  notes: null,
  label: null,
});

// `groundingSources` are the URLs the provider itself reports it searched
// (Claude web_search results / Gemini grounding chunks); they count as
// sources even when the model forgets to copy them into its JSON.
// `labelPhoto` is true when the request included a front-label photo: a
// clearly read label can identify a product without a web source.
function guardResult(parsed, groundingSources = [], { labelPhoto = false } = {}) {
  if (!parsed || typeof parsed !== "object") return { ...NOT_IDENTIFIED, guard: "unparseable" };
  const sources = cleanSources(parsed.sources);
  const allSources = sources.length > 0 ? sources : cleanSources(groundingSources);
  const label = labelPhoto ? cleanLabel(parsed.label) : null;

  const pl = parsed.productLine && typeof parsed.productLine === "object" ? parsed.productLine : parsed;
  const productLine = {
    name: cleanText(pl.name),
    distillery: cleanText(pl.distillery),
    brand: cleanText(pl.brand),
    category: CATEGORIES.includes(pl.category) ? pl.category : null,
    sizeMl: cleanNumber(pl.sizeMl, 50, 4500),
  };
  const rawCandidates = Array.isArray(parsed.candidates) && parsed.candidates.length > 0 ? parsed.candidates : [{}];
  const candidates = rawCandidates
    .slice(0, MAX_CANDIDATES)
    .map((c, i) => cleanCandidate(c, productLine, i))
    .filter(Boolean);

  const notIdentified = (guard) => ({ ...NOT_IDENTIFIED, sources: allSources, label, guard });
  if (parsed.identified !== true || candidates.length === 0) return notIdentified("model-not-identified");
  if (allSources.length === 0 && !(label && label.name)) return { ...notIdentified("no-source"), sources: [] };

  return {
    identified: true,
    productLine,
    upcSharedAcrossVariants: parsed.upcSharedAcrossVariants === true || candidates.length > 1,
    candidates,
    confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
    sources: allSources,
    notes: cleanText(parsed.notes, 300),
    label,
    guard: "ok",
  };
}

module.exports = {
  SYSTEM_PROMPT,
  LABEL_SYSTEM_PROMPT,
  PHOTO_PROMPT,
  upcPrompt,
  labelPrompt,
  extractJson,
  guardResult,
  NOT_IDENTIFIED,
  CATEGORIES,
  RELEASE_KINDS,
};
