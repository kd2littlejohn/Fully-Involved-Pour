// Administrator side of FIP's barcode catalog (docs/BARCODE_POC.md): how a
// user's private submission becomes a shared, verified candidate. Used by
// scripts/barcode-review.js with administrator credentials; nothing here is
// reachable from a client. Promotion copies only the product facts, never
// who submitted it, and an administrator decides each one by hand.

const { RELEASE_KINDS } = require("./identify");
const { normalizeBarcode } = require("./gtin");

const CANDIDATE_FIELDS = [
  "name", "distillery", "brand", "expression", "category", "sizeMl", "proof",
  "proofVaries", "ageStatement", "releaseKind", "batch", "barrel", "storePick", "releaseYear",
];

function slug(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

// What a candidate may contain. A proof only stays on a release with a known
// single proof: a standard release, or one specific batch/barrel/pick.
function toCandidate(bottle, id) {
  const candidate = {};
  for (const key of CANDIDATE_FIELDS) {
    if (bottle[key] !== undefined && bottle[key] !== null && bottle[key] !== "") candidate[key] = bottle[key];
  }
  if (typeof candidate.name !== "string" || !candidate.name.trim()) throw new Error("A candidate needs a name.");
  candidate.releaseKind = RELEASE_KINDS.includes(candidate.releaseKind) ? candidate.releaseKind : "standard";
  const specific = Boolean(candidate.batch || candidate.barrel || candidate.storePick);
  if (candidate.releaseKind !== "standard" && !specific) {
    // A generic "Barrel Proof" or "Single Barrel" line has no single proof.
    delete candidate.proof;
    candidate.proofVaries = true;
  }
  candidate.id = id || slug([candidate.name, candidate.batch, candidate.barrel, candidate.storePick].filter(Boolean).join(" "));
  return candidate;
}

// Submissions waiting for review, grouped by barcode, most requested first,
// with how often each barcode was looked up without a match.
async function listSubmissions(db) {
  const snap = await db.collectionGroup("barcodeEntries").where("submitForReview", "==", true).get();
  const byGtin = new Map();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!byGtin.has(d.gtin13)) byGtin.set(d.gtin13, []);
    byGtin.get(d.gtin13).push({ path: doc.ref.path, origin: d.origin, bottle: d.bottle });
  }
  const rows = [];
  for (const [gtin13, entries] of byGtin) {
    const [mapping, pending] = await Promise.all([db.doc(`upcMappings/${gtin13}`).get(), db.doc(`upcPending/${gtin13}`).get()]);
    rows.push({
      gtin13,
      submissions: entries,
      verifiedCandidates: mapping.exists ? (mapping.data().candidates || []).length : 0,
      lookupsWithoutMatch: pending.exists ? pending.data().lookups || 0 : 0,
    });
  }
  return rows.sort((a, b) => b.submissions.length - a.submissions.length || b.lookupsWithoutMatch - a.lookupsWithoutMatch);
}

// The barcodes people scan most that FIP's catalog still doesn't know —
// the ones worth verifying first, since each one verified is a scan that no
// longer needs Google or AXE. Counts only; no AI content is kept here.
async function listUnmatched(db, { limit = 25 } = {}) {
  const snap = await db.collection("upcPending").orderBy("lookups", "desc").limit(limit * 2).get();
  const rows = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const mapping = await db.doc(`upcMappings/${doc.id}`).get();
    if (mapping.exists && mapping.data().status === "verified") continue;
    rows.push({ gtin13: doc.id, lookups: d.lookups || 0, googleLookups: d.googleLookups || 0, axeLookups: d.aiLookups || 0, lastLookupAt: d.lastLookupAt || null });
    if (rows.length >= limit) break;
  }
  return rows;
}

// Adds (or replaces, by id) one verified candidate on upcMappings/{gtin13}.
async function promoteCandidate(db, gtin13, bottle, { id, verifiedBy, now = Date.now } = {}) {
  const normalized = normalizeBarcode(gtin13);
  if (normalized.error || normalized.restricted || normalized.gtin13 !== gtin13) throw new Error(`Not a product GTIN-13: ${gtin13}`);
  const candidate = { ...toCandidate(bottle, id), verifiedAt: now(), verifiedBy: verifiedBy || "admin" };
  const ref = db.doc(`upcMappings/${gtin13}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists && Array.isArray(snap.data().candidates) ? snap.data().candidates : [];
    const candidates = [...existing.filter((c) => c.id !== candidate.id), candidate];
    tx.set(ref, { gtin13, status: "verified", candidates, updatedAt: now() }, { merge: true });
  });
  return candidate;
}

async function promoteEntry(db, entryPath, options = {}) {
  const snap = await db.doc(entryPath).get();
  if (!snap.exists) throw new Error(`No entry at ${entryPath}`);
  const { gtin13, bottle, origin } = snap.data();
  // Google's terms don't allow building FIP's catalog from its results;
  // verify such a bottle from its label instead (barcode-review.js add).
  if (origin === "google") throw new Error("Entries identified by Google can't be promoted. Verify the bottle from its label and use add.");
  return promoteCandidate(db, gtin13, bottle, options);
}

module.exports = { listSubmissions, listUnmatched, promoteCandidate, promoteEntry, toCandidate };
