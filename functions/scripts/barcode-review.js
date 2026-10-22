// Barcode catalog review (docs/BARCODE_POC.md) — run by an administrator
// from a laptop; never deployed (firebase.json ignores scripts/).
//
// Credentials: Application Default Credentials for an account with
// Firestore access on the project (`gcloud auth application-default login`),
// or FIRESTORE_EMULATOR_HOST to try it against the emulator.
//
//   node scripts/barcode-review.js list
//   node scripts/barcode-review.js unmatched [--limit 25]
//   node scripts/barcode-review.js promote users/<uid>/barcodeEntries/<id> [--id <candidate-id>]
//   node scripts/barcode-review.js add <gtin13> '{"name":"…","releaseKind":"standard","proof":90,"sizeMl":750}'
//
// Check each submission against the bottle, its label or the producer's own
// site before promoting it: promoted candidates are shown to every FIP user
// as verified.

const admin = require("firebase-admin");
const { listSubmissions, listUnmatched, promoteEntry, promoteCandidate } = require("../barcode/review");

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "fully-involved-pour" });
const db = admin.firestore();

async function main() {
  const [command, target, ...rest] = process.argv.slice(2);
  const idFlag = rest.indexOf("--id");
  const id = idFlag >= 0 ? rest[idFlag + 1] : undefined;
  const verifiedBy = process.env.USER || "admin";

  if (command === "list") {
    const rows = await listSubmissions(db);
    if (rows.length === 0) return console.log("No submissions waiting for review.");
    for (const row of rows) {
      console.log(`\n${row.gtin13} — ${row.submissions.length} submission(s), ${row.verifiedCandidates} verified candidate(s), ${row.lookupsWithoutMatch} unmatched lookup(s)`);
      for (const s of row.submissions) {
        const b = s.bottle || {};
        console.log(`  ${s.path}\n    ${b.name}${b.batch ? ` · batch ${b.batch}` : ""}${b.barrel ? ` · barrel ${b.barrel}` : ""}${b.storePick ? ` · ${b.storePick} pick` : ""}${b.proof ? ` · ${b.proof} proof` : ""} [${b.releaseKind || "standard"}, from ${s.origin}]`);
      }
    }
    return;
  }
  if (command === "unmatched") {
    const limitFlag = process.argv.indexOf("--limit");
    const rows = await listUnmatched(db, { limit: limitFlag > 0 ? Number(process.argv[limitFlag + 1]) || 25 : 25 });
    if (rows.length === 0) return console.log("No unmatched barcodes.");
    console.log("Most-scanned barcodes not in the catalog yet (verify these first):");
    for (const r of rows) {
      console.log(`  ${r.gtin13}  ${r.lookups} scan(s) without a match · Google asked ${r.googleLookups}× · AXE asked ${r.axeLookups}×`);
    }
    return;
  }
  if (command === "promote" && target) {
    const candidate = await promoteEntry(db, target, { id, verifiedBy });
    return console.log("Verified:", JSON.stringify(candidate));
  }
  if (command === "add" && target && rest[0]) {
    const candidate = await promoteCandidate(db, target, JSON.parse(rest[0]), { id, verifiedBy });
    return console.log("Verified:", JSON.stringify(candidate));
  }
  console.log("Usage: barcode-review.js list | unmatched [--limit n] | promote <entry path> [--id <id>] | add <gtin13> '<json>' [--id <id>]");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
