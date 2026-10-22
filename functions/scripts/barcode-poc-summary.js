// Summarizes Scan Barcode field-test results copied or shared from the
// Barcode PoC page on a phone (docs/BARCODE_POC.md). Offline: reads the CSV
// only, makes no network calls and needs no keys.
//
//   node scripts/barcode-poc-summary.js fip-barcode-results.csv > summary.md

const fs = require("fs");
const { parseCsv } = require("../barcode/csv");
const { summarize } = require("../barcode/pocSummary");

const file = process.argv[2];
if (!file) {
  console.error("Usage: barcode-poc-summary.js <results.csv>");
  process.exit(1);
}
console.log(summarize(parseCsv(fs.readFileSync(file, "utf8"))));
