// Automatic first-pass grading for the Scan Barcode comparison
// (scripts/barcode-poc.js): compares what a provider suggested with the
// ground truth recorded while scanning (the label in hand). Deliberately
// simple token matching — the results CSV keeps a blank manual_grade column
// so a person makes the final call on anything not graded correct.
//
// A barcode can map to several releases, so a provider returns a candidate
// list. "correct" = the right release is the first candidate; "in-list" =
// it's offered but not first (the user can still pick it); "partial" =
// right producer or product line, wrong release; then "wrong" / "not-found".

const NOISE = new Set([
  "the", "a", "of", "and", "co", "company", "distillery", "distilleries", "distilling", "distillers",
  "whiskey", "whisky", "bourbon", "straight", "kentucky", "tennessee", "rye", "single", "malt", "scotch",
  "spirits", "brand", "brands", "inc", "llc", "ltd",
]);

function tokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/(\d+)\s*(yr|yrs|year|years|y\.?o\.?)\b/g, "$1yr")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !NOISE.has(t));
}

// Share of the expected tokens that appear anywhere in the candidate text.
function coverage(expected, candidate) {
  const want = [...new Set(tokens(expected))];
  if (want.length === 0) return null;
  const have = new Set(tokens(candidate));
  return want.filter((t) => have.has(t)).length / want.length;
}

const VARIES = new Set(["barrel-proof-batch", "single-barrel", "store-pick"]);

function scoreCandidate(truth, candidate) {
  const text = [candidate.name, candidate.expression, candidate.brand, candidate.distillery].join(" ");
  const nameScore = coverage(truth.expectedName, text);
  const distilleryScore = truth.expectedDistillery
    ? coverage(truth.expectedDistillery, [candidate.distillery, candidate.brand, candidate.name].join(" "))
    : null;
  const nameOk = nameScore !== null && nameScore >= 0.75;
  const distilleryOk = distilleryScore === null || distilleryScore >= 0.5;
  return { nameScore, distilleryScore, match: nameOk && distilleryOk, near: (nameScore ?? 0) >= 0.4 || (distilleryScore !== null && distilleryOk) };
}

function sameText(a, b) {
  return String(a || "").replace(/[^a-z0-9]/gi, "").toLowerCase() === String(b || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

// `raw` is the model's own JSON before the guard; `result` is after it.
// truth: { expectedName, expectedDistillery, variantKind, expectedProof?, expectedBatch? }
function gradeIdentification(truth, result, raw) {
  const overclaims = [];
  const rawCandidates = Array.isArray(raw?.candidates) ? raw.candidates : [];
  if (raw && raw.identified === true) {
    if (rawCandidates.some((c) => c && (c.batch || c.barrel))) overclaims.push("asserted-batch-or-barrel");
    if (VARIES.has(truth.variantKind)) {
      const top = rawCandidates[0] || raw;
      if (typeof top.proof === "number" && top.proofVaries !== true) overclaims.push("asserted-fixed-proof");
      if (raw.upcSharedAcrossVariants !== true && rawCandidates.length <= 1) overclaims.push("missed-shared-upc");
    }
  }

  const label = result?.label || null;
  const labelChecks = {
    labelProofCorrect:
      truth.expectedProof && label ? (typeof label.proof === "number" ? Math.abs(label.proof - Number(truth.expectedProof)) <= 0.15 : false) : null,
    labelBatchCorrect: truth.expectedBatch && label ? sameText(label.batch || label.barrel, truth.expectedBatch) : null,
  };

  const candidates = result?.identified ? result.candidates || [] : [];
  if (candidates.length === 0) return { verdict: "not-found", rank: null, nameScore: null, distilleryScore: null, candidateCount: 0, overclaims, ...labelChecks };

  const scores = candidates.map((c) => scoreCandidate(truth, c));
  const matchIndex = scores.findIndex((s) => s.match);
  const best = matchIndex >= 0 ? scores[matchIndex] : scores.reduce((a, b) => ((b.nameScore ?? 0) > (a.nameScore ?? 0) ? b : a));
  let verdict = "wrong";
  if (matchIndex === 0) verdict = "correct";
  else if (matchIndex > 0) verdict = "in-list";
  else if (scores.some((s) => s.near)) verdict = "partial";
  return {
    verdict,
    rank: matchIndex >= 0 ? matchIndex + 1 : null,
    nameScore: best.nameScore,
    distilleryScore: best.distilleryScore,
    candidateCount: candidates.length,
    overclaims,
    ...labelChecks,
  };
}

module.exports = { gradeIdentification, tokens, coverage };
