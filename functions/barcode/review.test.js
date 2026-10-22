// Administrator review of barcode submissions against the Firestore
// emulator: lists only entries submitted for review, promotes one into the
// shared verified candidates without copying who submitted it, keeps
// several candidates per barcode, and never keeps a proof on a generic
// variable-proof release. Uses its own uids (rv-*): test files share one
// emulator.
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
if (admin.apps.length === 0) admin.initializeApp();
const { listSubmissions, promoteEntry, promoteCandidate, toCandidate } = require("./review.js");

const db = admin.firestore();
const GTIN = "0012345000065";

beforeEach(async () => {
  for (const uid of ["rv-alice", "rv-bob"]) {
    const snap = await db.collection(`users/${uid}/barcodeEntries`).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await Promise.all([db.doc(`upcMappings/${GTIN}`).delete(), db.doc(`upcPending/${GTIN}`).delete()]);
});

describe("barcode review", () => {
  it("lists only submissions marked for review, grouped by barcode", async () => {
    await db.collection("users/rv-alice/barcodeEntries").add({ gtin13: GTIN, origin: "manual", submitForReview: true, bottle: { name: "Pick A" } });
    await db.collection("users/rv-bob/barcodeEntries").add({ gtin13: GTIN, origin: "axe-label", submitForReview: true, bottle: { name: "Pick B" } });
    await db.collection("users/rv-bob/barcodeEntries").add({ gtin13: GTIN, origin: "manual", submitForReview: false, bottle: { name: "Private" } });
    await db.doc(`upcPending/${GTIN}`).set({ lookups: 7 });
    const rows = (await listSubmissions(db)).filter((r) => r.gtin13 === GTIN);
    expect(rows).toHaveLength(1);
    expect(rows[0].submissions.map((s) => s.bottle.name).sort()).toEqual(["Pick A", "Pick B"]);
    expect(rows[0].lookupsWithoutMatch).toBe(7);
  });

  it("promotes a submission into the shared candidates without who submitted it", async () => {
    const ref = await db.collection("users/rv-alice/barcodeEntries").add({
      gtin13: GTIN,
      origin: "manual",
      submitForReview: true,
      bottle: { name: "Example Single Barrel", releaseKind: "store-pick", storePick: "Store A", barrel: "77", proof: 118.2 },
    });
    const candidate = await promoteEntry(db, ref.path, { verifiedBy: "tester" });
    const mapping = (await db.doc(`upcMappings/${GTIN}`).get()).data();
    expect(mapping.status).toBe("verified");
    expect(mapping.candidates).toEqual([candidate]);
    // A specific pick/barrel keeps its own proof.
    expect(candidate).toMatchObject({ storePick: "Store A", barrel: "77", proof: 118.2, verifiedBy: "tester" });
    expect(JSON.stringify(mapping)).not.toContain("rv-alice");
  });

  it("keeps several candidates per barcode and replaces one by id", async () => {
    await promoteCandidate(db, GTIN, { name: "Example", releaseKind: "standard", proof: 90 }, { id: "std" });
    await promoteCandidate(db, GTIN, { name: "Example Barrel Proof", releaseKind: "barrel-proof-batch", batch: "C924", proof: 124.6 }, { id: "c924" });
    await promoteCandidate(db, GTIN, { name: "Example", releaseKind: "standard", proof: 91 }, { id: "std" });
    const ids = (await db.doc(`upcMappings/${GTIN}`).get()).data().candidates.map((c) => [c.id, c.proof]);
    expect(ids).toEqual([["c924", 124.6], ["std", 91]]);
  });

  it("drops the proof from a generic variable-proof release", () => {
    expect(toCandidate({ name: "Example Barrel Proof", releaseKind: "barrel-proof-batch", proof: 124.6 })).toMatchObject({ proofVaries: true });
    expect(toCandidate({ name: "Example Barrel Proof", releaseKind: "barrel-proof-batch", proof: 124.6 })).not.toHaveProperty("proof");
  });

  it("refuses store-applied or malformed barcodes", async () => {
    await expect(promoteCandidate(db, "2001234567893", { name: "X" })).rejects.toThrow();
    await expect(promoteCandidate(db, "36000291452", { name: "X" })).rejects.toThrow();
  });
});
