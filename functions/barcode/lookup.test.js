// lookupBarcode against the Firestore emulator with the Anthropic call
// stubbed: verified mappings and the caller's own confirmation answer
// before any AI call, other users' confirmations never do, restricted
// labels never reach AI, and the guard drops unsourced or batch-specific
// answers. Uses its own uids (bc-*): test files share one emulator.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { lookupBarcode } = require("../index.js");

const db = admin.firestore();
const UPC = "036000291452";
const GTIN = "0036000291452";

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

const IDENTIFIED = {
  identified: true,
  name: "Example Bourbon Barrel Proof",
  distillery: "Example Distillery",
  brand: "Example",
  expression: "Barrel Proof",
  category: "Bourbon",
  sizeMl: 750,
  proof: 124.6,
  proofVaries: true,
  ageStatement: "12 Year",
  upcSharedAcrossVariants: true,
  confidence: "high",
  sources: [{ url: "https://example.com/p", title: "Example" }],
  notes: null,
};

beforeEach(async () => {
  sent = [];
  reply = claudeReply(IDENTIFIED);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => reply };
    }),
  );
  await Promise.all([
    db.doc(`upcMappings/${GTIN}`).delete(),
    db.doc(`upcConfirmations/${GTIN}/confirmedBy/bc-alice`).delete(),
    db.doc(`upcConfirmations/${GTIN}/confirmedBy/bc-bob`).delete(),
    db.doc("rateLimits/bc-alice_lookupBarcode").delete(),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const call = (uid, data) => lookupBarcode.run({ auth: uid ? { uid } : undefined, data });

describe("lookupBarcode", () => {
  it("requires sign-in and a valid barcode", async () => {
    await expect(call(null, { barcode: UPC })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(call("bc-alice", { barcode: "036000291453" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(sent).toHaveLength(0);
  });

  it("answers from an administrator-verified mapping without calling AI", async () => {
    await db.doc(`upcMappings/${GTIN}`).set({ status: "verified", name: "Verified Bourbon", sizeMl: 750, proof: 90 });
    const result = await call("bc-alice", { barcode: UPC });
    expect(result).toMatchObject({ source: "verified", gtin13: GTIN, bottle: { name: "Verified Bourbon", proof: 90 } });
    expect(sent).toHaveLength(0);
  });

  it("ignores a mapping that is not marked verified", async () => {
    await db.doc(`upcMappings/${GTIN}`).set({ status: "pending", name: "Unreviewed" });
    const result = await call("bc-alice", { barcode: UPC, skipAi: true });
    expect(result.source).toBe("unknown");
  });

  it("answers from the caller's own confirmation, including which bar bottle it was saved as", async () => {
    await db.doc(`upcConfirmations/${GTIN}/confirmedBy/bc-alice`).set({ gtin13: GTIN, name: "Alice's Bourbon", bottleId: "b7" });
    const result = await call("bc-alice", { barcode: UPC });
    expect(result).toMatchObject({ source: "your-confirmation", bottle: { name: "Alice's Bourbon" }, bottleId: "b7" });
    expect(sent).toHaveLength(0);
  });

  it("never answers from another user's confirmation", async () => {
    await db.doc(`upcConfirmations/${GTIN}/confirmedBy/bc-bob`).set({ gtin13: GTIN, name: "Bob's Mistake" });
    const result = await call("bc-alice", { barcode: UPC, skipAi: true });
    expect(result.source).toBe("unknown");
  });

  it("never sends a store-applied label to AI", async () => {
    const result = await call("bc-alice", { barcode: "212345678909" });
    expect(result.source).toBe("restricted");
    expect(sent).toHaveLength(0);
  });

  it("asks Claude with web search for an unknown barcode and keeps only product-line facts", async () => {
    const result = await call("bc-alice", { barcode: UPC });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(sent[0].body.tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 3 }]);
    expect(JSON.stringify(sent[0].body.messages)).toContain(UPC);
    expect(result.source).toBe("ai");
    expect(result.bottle).toMatchObject({ name: "Example Bourbon Barrel Proof", sizeMl: 750, proofVaries: true });
    // Barrel proof varies by batch: the model's proof for one batch is dropped.
    expect(result.bottle.proof).toBeNull();
    // Nothing is written until the user confirms.
    expect((await db.doc(`upcMappings/${GTIN}`).get()).exists).toBe(false);
    expect((await db.collection(`upcConfirmations/${GTIN}/confirmedBy`).get()).size).toBe(0);
  });

  it("keeps a fixed proof for a product bottled at one proof", async () => {
    reply = claudeReply({ ...IDENTIFIED, name: "Example 100 Proof", proof: 100, proofVaries: false, upcSharedAcrossVariants: false });
    const result = await call("bc-alice", { barcode: UPC });
    expect(result.bottle.proof).toBe(100);
  });

  it("reports not-found when the model cites no source at all", async () => {
    reply = claudeReply({ ...IDENTIFIED, sources: [] }, { sources: [], searches: 1 });
    const result = await call("bc-alice", { barcode: UPC });
    expect(result.source).toBe("not-found");
    expect(result.bottle).toBeUndefined();
  });

  it("reports not-found when the model declines or returns junk", async () => {
    reply = claudeReply({ identified: false });
    expect((await call("bc-alice", { barcode: UPC })).source).toBe("not-found");
    reply = { stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "I think it's probably a bourbon." }] };
    expect((await call("bc-alice", { barcode: UPC })).source).toBe("not-found");
  });

  it("maps an Anthropic outage to an internal error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 529, text: async () => "overloaded" })));
    await expect(call("bc-alice", { barcode: UPC })).rejects.toMatchObject({ code: "internal" });
  });

  it("rate-limits AI lookups per user", async () => {
    await db.doc("rateLimits/bc-alice_lookupBarcode").set({ count: 20, windowStart: Date.now() });
    await expect(call("bc-alice", { barcode: UPC })).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(sent).toHaveLength(0);
  });
});
