// Automatic first-pass grading for the Scan Barcode comparison
// (scripts/barcodePoc.mjs): compares what a provider identified with the
// ground truth recorded while scanning (the label in hand). Deliberately
// simple token matching — the results CSV keeps a blank manual_grade column
// so a person makes the final call on anything marked partial or wrong.

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

// `raw` is the model's own JSON before the guard; `result` is after it.
function gradeIdentification({ expectedName, expectedDistillery, variantKind }, result, raw) {
  const overclaims = [];
  if (VARIES.has(variantKind) && raw && raw.identified === true) {
    if (typeof raw.proof === "number" && raw.proofVaries !== true) overclaims.push("asserted-fixed-proof");
    if (raw.upcSharedAcrossVariants !== true) overclaims.push("missed-shared-upc");
  }
  if (!result || !result.identified) return { verdict: "not-found", nameScore: null, distilleryScore: null, overclaims };

  const everything = [result.name, result.brand, result.expression, result.distillery].join(" ");
  const nameScore = coverage(expectedName, everything);
  const distilleryScore = expectedDistillery ? coverage(expectedDistillery, [result.distillery, result.brand, result.name].join(" ")) : null;

  const nameOk = nameScore !== null && nameScore >= 0.75;
  const distilleryOk = distilleryScore === null || distilleryScore >= 0.5;
  let verdict = "wrong";
  if (nameOk && distilleryOk) verdict = "correct";
  else if ((nameScore ?? 0) >= 0.4 || (distilleryScore !== null && distilleryOk)) verdict = "partial";
  return { verdict, nameScore, distilleryScore, overclaims };
}

module.exports = { gradeIdentification, tokens, coverage };
