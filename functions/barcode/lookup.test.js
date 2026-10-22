// lookupBarcode and identifyBottleLabel against the Firestore emulator with
// the Anthropic call stubbed: verified candidates and the caller's own
// entries answer before any AI call; AI runs only when asked; one barcode
// can return several candidates; other users' entries are never read; a
// recent unverified Claude suggestion is reused instead of paid for again;
// batch/barrel/variable proof never come from AI candidates.
// Uses its own uids (bc-*): test files share one emulator.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { lookupBarcode, identifyBottleLabel } = require("../index.js");
const { handleLookupBarcode } = require("./lookup.js");

const db = admin.firestore();
const UPC = "036000291452";
const GTIN = "0036000291452";
const IMAGE = "A".repeat(400);

let sent = [];
let reply;
function claudeReply(json, { sources = [{ url: "https://example.com/p", title: "Example" }], searches = 1 } = {}) {
  return {
    stop_reason: "end_turn",
    usage: { input_tokens: 9000, output_tokens: 300, server_tool_use: { web_search_requests: searches } },
    content: [
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: UPC } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: sources.map((s) => ({ type: "web_search_result", ...s })) },
      { type: "text", text: JSON.stringify(json) },
    ],
  };
}

const AXE = {
  identified: true,
  productLine: { name: "Example Bourbon", distillery: "Example Distillery", brand: "Example", category: "Bourbon", sizeMl: 750 },
  upcSharedAcrossVariants: true,
  candidates: [
    { name: "Example Bourbon", expression: "Standard", releaseKind: "standard", proof: 90, proofVaries: false },
    { name: "Example Bourbon Barrel Proof", expression: "Barrel Proof", releaseKind: "barrel-proof-batch", proof: 124.6, proofVaries: false, batch: "C924" },
    { name: "Example Bourbon Single Barrel", releaseKind: "single-barrel", proof: 115, barrel: "5521" },
  ],
  confidence: "medium",
  sources: [{ url: "https://example.com/p", title: "Example" }],
};

async function clearUser(uid) {
  const entries = await db.collection(`users/${uid}/barcodeEntries`).get();
  await Promise.all(entries.docs.map((d) => d.ref.delete()));
}

beforeEach(async () => {
  sent = [];
  reply = claudeReply(AXE);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => reply };
    }),
  );
  await Promise.all([
    db.doc(`upcMappings/${GTIN}`).delete(),
    db.doc(`upcPending/${GTIN}`).delete(),
    db.doc("rateLimits/bc-alice_lookupBarcode").delete(),
    db.doc("rateLimits/bc-alice_identifyBottleLabel").delete(),
    db.doc("rateLimits/bc-bob_lookupBarcode").delete(),
    clearUser("bc-alice"),
    clearUser("bc-bob"),
    db.doc("rateLimits/bc-carol_lookupBarcode").delete(),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lookup = (uid, data) => lookupBarcode.run({ auth: uid ? { uid } : undefined, data });
const label = (uid, data) => identifyBottleLabel.run({ auth: uid ? { uid } : undefined, data });

describe("lookupBarcode", () => {
  it("requires sign-in and a valid barcode", async () => {
    await expect(lookup(null, { barcode: UPC })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(lookup("bc-alice", { barcode: "036000291453" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(sent).toHaveLength(0);
  });

  it("returns every verified candidate for a barcode without calling AI", async () => {
    await db.doc(`upcMappings/${GTIN}`).set({
      status: "verified",
      candidates: [
        { id: "std", name: "Verified Bourbon", proof: 90, releaseKind: "standard", sizeMl: 750 },
        { id: "c924", name: "Verified Bourbon Barrel Proof", releaseKind: "barrel-proof-batch", batch: "C924", proof: 124.6 },
      ],
    });
    const result = await lookup("bc-alice", { barcode: UPC });
    expect(result.status).toBe("matched");
    expect(result.verified.map((c) => c.id)).toEqual(["std", "c924"]);
    // An administrator-verified batch keeps its batch and proof.
    expect(result.verified[1]).toMatchObject({ batch: "C924", proof: 124.6 });
    expect(sent).toHaveLength(0);
  });

  it("reads a mapping written before candidates existed as one candidate", async () => {
    await db.doc(`upcMappings/${GTIN}`).set({ status: "verified", name: "Flat Bourbon", proof: 100 });
    const result = await lookup("bc-alice", { barcode: UPC });
    expect(result.verified).toEqual([expect.objectContaining({ id: `${GTIN}-1`, name: "Flat Bourbon", proof: 100 })]);
  });

  it("ignores a mapping that is not marked verified", async () => {
    await db.doc(`upcMappings/${GTIN}`).set({ status: "pending", candidates: [{ name: "Unreviewed" }] });
    expect((await lookup("bc-alice", { barcode: UPC })).status).toBe("no-match");
  });

  it("returns all of the caller's own entries for the barcode, and never another user's", async () => {
    const entry = (name, extra = {}) => ({ gtin13: GTIN, origin: "manual", bottle: { name, ...extra }, createdAt: new Date() });
    await db.collection("users/bc-alice/barcodeEntries").add(entry("Pick from Store A", { releaseKind: "store-pick", storePick: "Store A" }));
    await db.collection("users/bc-alice/barcodeEntries").add({ ...entry("Pick from Store B"), bottleId: "b9" });
    await db.collection("users/bc-bob/barcodeEntries").add(entry("Bob's Mistake"));
    const result = await lookup("bc-alice", { barcode: UPC });
    expect(result.status).toBe("matched");
    expect(result.yours.map((e) => e.bottle.name).sort()).toEqual(["Pick from Store A", "Pick from Store B"]);
    expect(result.yours.find((e) => e.bottleId === "b9")).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it("reports no-match without calling AI, and counts the demand for review", async () => {
    const result = await lookup("bc-alice", { barcode: UPC });
    expect(result).toMatchObject({ status: "no-match", verified: [], yours: [] });
    expect(sent).toHaveLength(0);
    await lookup("bc-bob", { barcode: UPC });
    expect((await db.doc(`upcPending/${GTIN}`).get()).data().lookups).toBe(2);
  });

  it("never looks up a store-applied label", async () => {
    const result = await lookup("bc-alice", { barcode: "212345678909", useAxe: true });
    expect(result.status).toBe("restricted");
    expect(sent).toHaveLength(0);
  });

  it("asks Claude with web search only when the user asks AXE, and returns several candidates", async () => {
    const result = await lookup("bc-alice", { barcode: UPC, useAxe: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].body.tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 3 }]);
    expect(JSON.stringify(sent[0].body.messages)).toContain(UPC);
    expect(result.status).toBe("suggested");
    expect(result.axe.cached).toBe(false);
    expect(result.axe.candidates.map((c) => c.releaseKind)).toEqual(["standard", "barrel-proof-batch", "single-barrel"]);
    // Fixed-proof standard release keeps its proof; variable releases never do.
    expect(result.axe.candidates.map((c) => c.proof)).toEqual([90, null, null]);
    // Batch and barrel numbers never come from AI.
    for (const c of result.axe.candidates) {
      expect(c).not.toHaveProperty("batch");
      expect(c).not.toHaveProperty("barrel");
    }
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it("is available to any signed-in user", async () => {
    expect((await lookup("bc-carol", { barcode: UPC, useAxe: true })).status).toBe("suggested");
  });

  it("does not reuse or store AI suggestions by default (pending terms sign-off)", async () => {
    await lookup("bc-alice", { barcode: UPC, useAxe: true });
    const second = await lookup("bc-bob", { barcode: UPC, useAxe: true });
    expect(sent).toHaveLength(2);
    expect(second.axe.cached).toBe(false);
    const pending = (await db.doc(`upcPending/${GTIN}`).get()).data();
    expect(pending.aiLookups).toBe(2);
    expect(pending.suggestion).toBeUndefined();
  });

  it("can reuse a recent Claude suggestion when reuse is switched on", async () => {
    const deps = { apiKey: "test-key", assertNotRateLimited: async () => {}, reuseAiSuggestions: true };
    const call = (uid) => handleLookupBarcode(db, { auth: { uid }, data: { barcode: UPC, useAxe: true } }, deps);
    await call("bc-alice");
    const second = await call("bc-bob");
    expect(sent).toHaveLength(1);
    expect(second).toMatchObject({ status: "suggested", costUsd: 0, axe: { cached: true } });
    expect(second.axe.candidates).toHaveLength(3);
  });

  it("asks again once a stored suggestion has expired", async () => {
    await db.doc(`upcPending/${GTIN}`).set({ suggestion: { provider: "claude", expiresAt: Date.now() - 1, result: { identified: true, candidates: [] } } });
    const deps = { apiKey: "test-key", assertNotRateLimited: async () => {}, reuseAiSuggestions: true };
    await handleLookupBarcode(db, { auth: { uid: "bc-alice" }, data: { barcode: UPC, useAxe: true } }, deps);
    expect(sent).toHaveLength(1);
  });

  it("reports not-found when the model cites no source", async () => {
    reply = claudeReply({ ...AXE, sources: [] }, { sources: [] });
    const result = await lookup("bc-alice", { barcode: UPC, useAxe: true });
    expect(result.status).toBe("not-found");
    expect(result.axe.candidates).toEqual([]);
  });

  it("reports not-found when the model declines or returns junk", async () => {
    reply = claudeReply({ identified: false });
    expect((await lookup("bc-alice", { barcode: UPC, useAxe: true })).status).toBe("not-found");
    await db.doc(`upcPending/${GTIN}`).delete();
    reply = { stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "Probably a bourbon." }] };
    expect((await lookup("bc-alice", { barcode: UPC, useAxe: true })).status).toBe("not-found");
  });

  it("maps an Anthropic outage to an internal error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 529, text: async () => "overloaded" })));
    await expect(lookup("bc-alice", { barcode: UPC, useAxe: true })).rejects.toMatchObject({ code: "internal" });
  });

  it("rate-limits AI lookups per user", async () => {
    await db.doc("rateLimits/bc-alice_lookupBarcode").set({ count: 20, windowStart: Date.now() });
    await expect(lookup("bc-alice", { barcode: UPC, useAxe: true })).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(sent).toHaveLength(0);
  });
});

describe("identifyBottleLabel", () => {
  const LABEL_REPLY = {
    ...AXE,
    label: { name: "Example Bourbon Barrel Proof", proof: 124.6, batch: "C924", barrel: null, storePick: null, ageStatement: "12 Years", sizeMl: 750 },
  };

  it("requires sign-in and a usable photo", async () => {
    await expect(label(null, { imageBase64: IMAGE })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(label("bc-alice", { imageBase64: "x" })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(label("bc-alice", { imageBase64: IMAGE, mediaType: "image/gif" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(sent).toHaveLength(0);
  });

  it("sends the label photo with the barcode and keeps label readings apart from candidates", async () => {
    reply = claudeReply(LABEL_REPLY);
    const result = await label("bc-alice", { barcode: UPC, imageBase64: IMAGE, mediaType: "image/jpeg" });
    const content = sent[0].body.messages[0].content;
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: IMAGE } });
    expect(content[1].text).toContain(UPC);
    expect(result.status).toBe("suggested");
    // Read from this bottle's label — reported, not merged into candidates.
    expect(result.axe.label).toMatchObject({ proof: 124.6, batch: "C924", ageStatement: "12 Years" });
    expect(result.axe.candidates[1]).toMatchObject({ releaseKind: "barrel-proof-batch", proof: null });
    expect(result.axe.candidates[1]).not.toHaveProperty("batch");
    // Photo-specific: never stored.
    expect((await db.doc(`upcPending/${GTIN}`).get()).exists).toBe(false);
  });

  it("can identify from a clearly read label alone, without a barcode or web source", async () => {
    reply = claudeReply({ ...LABEL_REPLY, sources: [] }, { sources: [] });
    const result = await label("bc-alice", { imageBase64: IMAGE });
    expect(result.gtin13).toBeNull();
    expect(result.status).toBe("suggested");
    expect(JSON.stringify(sent[0].body.messages)).toContain("No barcode was scanned");
  });

  it("reports not-found with no source and no readable product name", async () => {
    reply = claudeReply({ ...AXE, sources: [], label: { proof: 100 } }, { sources: [] });
    const result = await label("bc-alice", { imageBase64: IMAGE });
    expect(result.status).toBe("not-found");
    expect(result.axe.label).toMatchObject({ proof: 100 });
  });

  it("derives proof from a printed ABV", async () => {
    reply = claudeReply({ ...LABEL_REPLY, label: { name: "Example", abv: 53.5 } });
    expect((await label("bc-alice", { imageBase64: IMAGE })).axe.label.proof).toBe(107);
  });

  it("has its own rate limit", async () => {
    await db.doc("rateLimits/bc-alice_identifyBottleLabel").set({ count: 20, windowStart: Date.now() });
    await expect(label("bc-alice", { imageBase64: IMAGE })).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(sent).toHaveLength(0);
  });
});
