// Scan Barcode's Google step (Gemini + Grounding with Google Search) against
// the Firestore emulator with the Gemini call stubbed: off unless switched
// on; asked only for a barcode the catalog doesn't know, and only when the
// app asks; only Google's own grounding sources count and are returned,
// with the Search Suggestions; nothing Google returns is stored; budget,
// App Check and per-user limits skip Google (offering AXE) instead of
// failing. Uses its own uids (bg-*): test files share one emulator.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-gemini-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { lookupBarcode } = require("../index.js");
const { handleLookupBarcode, GOOGLE_LOOKUPS_PER_HOUR } = require("./lookup.js");
const { resetGoogleConfigCache, sanitize } = require("./googleConfig.js");
const { resetGeminiModelCache, resolveGeminiModel, classifyFailure } = require("./providers/gemini.js");
const { assertNotRateLimited } = require("../rateLimit.js");

const db = admin.firestore();
const UPC = "080244009236";
const GTIN = "0080244009236";
const MONTH = new Date().toISOString().slice(0, 7);
const SPEND = `aiSpend/gemini-${MONTH}`;
const SUGGESTIONS_HTML = '<style>.chip{}</style><div class="container"><a class="chip" href="https://www.google.com/search?q=080244009236">080244009236</a></div>';

const ANSWER = {
  identified: true,
  productLine: { name: "Example Bourbon", distillery: "Example Distillery", brand: "Example", category: "Bourbon", sizeMl: 750 },
  upcSharedAcrossVariants: true,
  candidates: [
    { name: "Example Bourbon", releaseKind: "standard", proof: 90, proofVaries: false },
    { name: "Example Bourbon Barrel Proof", releaseKind: "barrel-proof-batch", proof: 124.6, batch: "C924" },
  ],
  confidence: "high",
  // Written by the model itself — never counted or shown.
  sources: [{ url: "https://invented.example/p", title: "Invented" }],
};

function geminiReply(json, { chunks = [{ web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "example.com" } }], suggestions = SUGGESTIONS_HTML, queries = ["080244009236"] } = {}) {
  return {
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(json) }] },
        groundingMetadata: {
          webSearchQueries: queries,
          groundingChunks: chunks,
          ...(suggestions ? { searchEntryPoint: { renderedContent: suggestions } } : {}),
        },
      },
    ],
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 250, thoughtsTokenCount: 100 },
  };
}

let sent = [];
let reply;
// What Google's model list returns for the key (read before each call).
let available = ["gemini-3-flash", "gemini-3.5-flash"];
const modelList = () => ({ models: available.map((m) => ({ name: `models/${m}`, supportedGenerationMethods: ["generateContent"] })) });
const ON = { enabled: true, apiKey: "test-gemini-key", monthlyBudgetUsd: 20, requireAppCheck: false, model: "gemini-3-flash" };
const deps = (google = ON, extra = {}) => ({ apiKey: "test-key", google, assertNotRateLimited, ...extra });
const call = (uid, data, google, request = {}) => handleLookupBarcode(db, { auth: { uid }, data: { barcode: UPC, ...data }, ...request }, deps(google));

beforeEach(async () => {
  sent = [];
  reply = geminiReply(ANSWER);
  available = ["gemini-3-flash", "gemini-3.5-flash"];
  resetGoogleConfigCache();
  resetGeminiModelCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      if (String(url).includes("/models?")) return { ok: true, json: async () => modelList() };
      sent.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
      return { ok: true, json: async () => reply };
    }),
  );
  await Promise.all([
    db.doc(`upcMappings/${GTIN}`).delete(),
    db.doc(`upcPending/${GTIN}`).delete(),
    db.doc(SPEND).delete(),
    db.doc("appConfig/barcodeGoogle").delete(),
    db.doc("rateLimits/bg-alice_lookupBarcodeGoogle").delete(),
    db.doc("rateLimits/bg-alice_lookupBarcode").delete(),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google step: switched off", () => {
  it("is off unless appConfig/barcodeGoogle.enabled is true", async () => {
    const run = (data) => lookupBarcode.run({ auth: { uid: "bg-alice" }, data: { barcode: UPC, ...data } });
    expect(await run({})).toMatchObject({ status: "no-match", googleAvailable: false, googleStatus: "off" });
    expect((await run({ useGoogle: true })).google).toEqual({ status: "off" });
    await db.doc("appConfig/barcodeGoogle").set({ enabled: false });
    resetGoogleConfigCache();
    expect((await run({ useGoogle: true })).google).toEqual({ status: "off" });
    expect(sent).toHaveLength(0);
  });

  it("can be switched on from appConfig without a redeploy", async () => {
    await db.doc("appConfig/barcodeGoogle").set({ enabled: true });
    const run = (data) => lookupBarcode.run({ auth: { uid: "bg-alice" }, data: { barcode: UPC, ...data } });
    expect((await run({})).googleAvailable).toBe(true);
    expect((await run({ useGoogle: true })).google.status).toBe("identified");
    expect(sent).toHaveLength(1);
  });

  it("says when the API key is missing", async () => {
    expect(await call("bg-alice", {}, { ...ON, apiKey: "" })).toMatchObject({ googleAvailable: false, googleStatus: "no-key" });
    expect((await call("bg-alice", { useGoogle: true }, { ...ON, apiKey: "" })).google).toEqual({ status: "no-key" });
    expect(sent).toHaveLength(0);
  });

  it("says when the switch couldn't be read", async () => {
    expect(await call("bg-alice", {}, { ...ON, enabled: false, configError: true })).toMatchObject({ googleStatus: "config-error" });
  });

  it("trims a pasted key before using it", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key\n";
    await db.doc("appConfig/barcodeGoogle").set({ enabled: true });
    const result = await lookupBarcode.run({ auth: { uid: "bg-alice" }, data: { barcode: UPC, useGoogle: true } });
    process.env.GEMINI_API_KEY = "test-gemini-key";
    expect(result.google.status).toBe("identified");
    expect(sent[0].headers["x-goog-api-key"]).toBe("test-gemini-key");
  });

  it("reads config defensively", () => {
    expect(sanitize(null)).toMatchObject({ enabled: false, monthlyBudgetUsd: 20, requireAppCheck: false });
    expect(sanitize({ enabled: "yes", monthlyBudgetUsd: -5, model: "../x" })).toMatchObject({ enabled: false, monthlyBudgetUsd: 20, model: "gemini-3-flash" });
    expect(sanitize({ enabled: true, monthlyBudgetUsd: 0, model: "gemini-3.5-flash" })).toMatchObject({ enabled: true, monthlyBudgetUsd: 0, model: "gemini-3.5-flash" });
  });
});

describe("Google step: switched on", () => {
  it("is not called by the plain catalog lookup, which only says it is available", async () => {
    expect(await call("bg-alice", {})).toMatchObject({ status: "no-match", googleAvailable: true, googleStatus: "available" });
    expect(sent).toHaveLength(0);
  });

  it("asks Gemini with Google Search grounding, server-side, for the decoded barcode", async () => {
    const result = await call("bg-alice", { useGoogle: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toContain("generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent");
    expect(sent[0].headers["x-goog-api-key"]).toBe("test-gemini-key");
    expect(sent[0].body.tools).toEqual([{ google_search: {} }]);
    expect(JSON.stringify(sent[0].body.contents)).toContain(UPC);
    expect(result.status).toBe("suggested");
    expect(result.google.status).toBe("identified");
  });

  it("returns several releases without batch, barrel or variable proof", async () => {
    const { google } = await call("bg-alice", { useGoogle: true });
    expect(google.result.candidates.map((c) => c.releaseKind)).toEqual(["standard", "barrel-proof-batch"]);
    expect(google.result.candidates.map((c) => c.proof)).toEqual([90, null]);
    for (const c of google.result.candidates) {
      expect(c).not.toHaveProperty("batch");
      expect(c).not.toHaveProperty("barrel");
    }
  });

  it("returns Google's Search Suggestions and only Google's own grounding sources", async () => {
    const { google } = await call("bg-alice", { useGoogle: true });
    expect(google.searchEntryPoint).toBe(SUGGESTIONS_HTML);
    expect(google.result.sources).toEqual([{ url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "example.com" }]);
  });

  it("does not count an answer Google didn't ground in search results", async () => {
    reply = geminiReply(ANSWER, { chunks: [] });
    const result = await call("bg-alice", { useGoogle: true });
    expect(result.status).toBe("not-found");
    expect(result.google).toMatchObject({ status: "not-found", result: { identified: false, candidates: [] } });
  });

  it("does not show an answer that came without Search Suggestions", async () => {
    reply = geminiReply(ANSWER, { suggestions: null });
    expect((await call("bg-alice", { useGoogle: true })).google).toMatchObject({ status: "not-found", result: { candidates: [] } });
  });

  it("reports not-found when Gemini declines or returns junk", async () => {
    reply = geminiReply({ identified: false });
    expect((await call("bg-alice", { useGoogle: true })).google.status).toBe("not-found");
    reply = { candidates: [{ content: { parts: [{ text: "Probably bourbon." }] } }], usageMetadata: {} };
    expect((await call("bg-alice", { useGoogle: true })).google.status).toBe("not-found");
  });

  it("stores no Google content — only counts and the estimated spend", async () => {
    await call("bg-alice", { useGoogle: true });
    const pending = (await db.doc(`upcPending/${GTIN}`).get()).data();
    expect(pending).toMatchObject({ gtin13: GTIN, googleLookups: 1 });
    expect(Object.keys(pending).sort()).toEqual(["googleLookups", "gtin13", "lastLookupAt"]);
    const spend = (await db.doc(SPEND).get()).data();
    expect(spend.calls).toBe(1);
    expect(spend.searchQueries).toBe(1);
    // 900 in × $0.50/M + 350 out × $3/M + 1 query × $0.014
    expect(spend.estimatedUsd).toBeCloseTo(0.0155, 4);
  });

  it("skips Google once the month's estimated spend reaches the budget", async () => {
    await db.doc(SPEND).set({ estimatedUsd: 20 });
    expect(await call("bg-alice", {})).toMatchObject({ googleAvailable: false });
    expect((await call("bg-alice", { useGoogle: true })).google).toEqual({ status: "budget" });
    expect(sent).toHaveLength(0);
  });

  it("requires App Check when configured to", async () => {
    const strict = { ...ON, requireAppCheck: true };
    expect((await call("bg-alice", { useGoogle: true }, strict)).google).toEqual({ status: "app-check" });
    expect(sent).toHaveLength(0);
    const ok = await call("bg-alice", { useGoogle: true }, strict, { app: { appId: "web-app" } });
    expect(ok.google.status).toBe("identified");
  });

  it("rate-limits per user and offers AXE instead of failing", async () => {
    await db.doc("rateLimits/bg-alice_lookupBarcodeGoogle").set({ count: GOOGLE_LOOKUPS_PER_HOUR, windowStart: Date.now() });
    const result = await call("bg-alice", { useGoogle: true });
    expect(result).toMatchObject({ status: "not-found", google: { status: "rate-limited" } });
    expect(sent).toHaveLength(0);
  });

  it("turns a Gemini outage into a status with a reason, not an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, text: async () => "unavailable" })));
    expect((await call("bg-alice", { useGoogle: true })).google).toEqual({ status: "error", reason: "unavailable" });
  });

  it("reports a rejected key, an exhausted quota and a missing model by name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, text: async () => '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}' })));
    expect((await call("bg-alice", { useGoogle: true })).google).toEqual({ status: "error", reason: "auth" });
    expect(classifyFailure(429, "RESOURCE_EXHAUSTED")).toBe("quota");
    expect(classifyFailure(404, "models/gemini-x is not found for API version v1beta")).toBe("model-unavailable");
  });

  it("uses a model the key can actually call, not an assumed name", async () => {
    available = ["gemini-3-flash-preview", "gemini-3.5-flash"];
    await call("bg-alice", { useGoogle: true });
    expect(sent[0].url).toContain("/models/gemini-3-flash-preview:generateContent");
    resetGeminiModelCache();
    available = ["gemini-3.5-flash"];
    const result = await call("bg-alice", { useGoogle: true });
    expect(sent[1].url).toContain("/models/gemini-3.5-flash:generateContent");
    expect(result.google.model).toBe("gemini-3.5-flash");
  });

  it("falls back to any Flash model the key offers, and names the problem when there is none", async () => {
    const list = (models) => ({ ok: true, json: async () => ({ models: models.map((m) => ({ name: `models/${m}`, supportedGenerationMethods: ["generateContent"] })) }) });
    expect(await resolveGeminiModel("k", "gemini-3-flash", { fetchImpl: async () => list(["gemini-4.1-flash", "gemini-embedding-001"]) })).toBe("gemini-4.1-flash");
    resetGeminiModelCache();
    await expect(resolveGeminiModel("k", "gemini-3-flash", { fetchImpl: async () => list(["gemini-embedding-001"]) })).rejects.toMatchObject({ reason: "model-unavailable" });
  });

  it("still returns verified and saved candidates alongside Google's", async () => {
    await db.doc(`upcMappings/${GTIN}`).set({ status: "verified", candidates: [{ id: "std", name: "Verified Bourbon" }] });
    const result = await call("bg-alice", { useGoogle: true });
    expect(result.verified.map((c) => c.id)).toEqual(["std"]);
    expect(result.google.status).toBe("identified");
  });

  it("never asks Google about a store-applied label", async () => {
    const result = await handleLookupBarcode(db, { auth: { uid: "bg-alice" }, data: { barcode: "212345678909", useGoogle: true } }, deps());
    expect(result.status).toBe("restricted");
    expect(sent).toHaveLength(0);
  });

  it("requires sign-in", async () => {
    await expect(handleLookupBarcode(db, { data: { barcode: UPC, useGoogle: true } }, deps())).rejects.toMatchObject({ code: "unauthenticated" });
  });
});
