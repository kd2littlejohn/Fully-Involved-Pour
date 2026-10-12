// End-to-end check of the AXE endpoint (askSommelier) against the real
// Firestore emulator: the prompt is built only from the *caller's* own
// users/{uid} doc, never from payload-supplied uids or client-built
// summaries, and Blind Room identities stay concealed until reveal. The
// Anthropic call is stubbed — we assert on the exact request it would send.
// Run via `npm run test:functions` at the repo root (emulators:exec).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { askSommelier } = require("./index.js");

const db = admin.firestore();
let sentBodies = [];
let sentRequests = [];

beforeAll(async () => {
  await db.doc("users/alice").set({
    bottles: [{ id: "a1", name: "Alice Own Bottle", status: "open", proof: 100 }],
    pours: [],
    memories: [],
    infinityBottles: [],
  });
  await db.doc("users/bob").set({
    bottles: [{ id: "b1", name: "Bob Private Bottle", status: "open" }],
    pours: [],
    memories: [],
    infinityBottles: [],
  });
  await db.doc("blindRooms/r1").set({ name: "Friday Flight", hostUid: "bob", state: "tasting", pourCount: 2, sessionType: "live", knowledgeMode: "single" });
  await db.doc("blindRooms/r1/participants/alice").set({ uid: "alice", isHost: false });
  await db.doc("blindRoomSecrets/r1").set({ roomId: "r1", pours: [{ label: "A", bottleId: "x", bottleName: "Concealed Stagg" }] });
});

beforeEach(async () => {
  sentBodies = [];
  sentRequests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      sentRequests.push({ url, init });
      sentBodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ content: [{ text: "Here's a thought." }] }) };
    }),
  );
  const limits = await db.collection("rateLimits").get();
  await Promise.all(limits.docs.map((d) => d.ref.delete()));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("askSommelier (AXE) against the Firestore emulator", () => {
  it("rejects unauthenticated calls", async () => {
    await expect(askSommelier.run({ data: { prompt: "hi" } })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("builds context only from the caller's own document, ignoring payload uids and client summaries", async () => {
    const result = await askSommelier.run({
      auth: { uid: "alice" },
      data: { prompt: "What should I pour?", uid: "bob", collectionSummary: "Bob Private Bottle", context: { screen: "collection" } },
    });
    expect(result.reply).toBe("Here's a thought.");
    const system = sentBodies[0].system;
    expect(system).toContain("Alice Own Bottle");
    expect(system).not.toContain("Bob Private Bottle");
    expect(sentBodies[0].messages.at(-1)).toEqual({ role: "user", content: "What should I pour?" });
  });

  it("can't pull another user's bottle by id", async () => {
    await askSommelier.run({ auth: { uid: "alice" }, data: { prompt: "Tell me about it", context: { screen: "bottle", bottleId: "b1" } } });
    expect(sentBodies[0].system).toContain("SELECTED BOTTLE: not found");
    expect(sentBodies[0].system).not.toContain("Bob Private Bottle");
  });

  it("keeps a pre-reveal Blind Room lineup concealed, even for a member", async () => {
    await askSommelier.run({ auth: { uid: "alice" }, data: { prompt: "Which pour is Stagg?", context: { screen: "blind", roomId: "r1" } } });
    const system = sentBodies[0].system;
    expect(system).toContain("CONCEALED");
    expect(system).not.toContain("Concealed Stagg");
    expect(system).not.toContain("Alice Own Bottle");
  });

  it("gives non-members nothing about a room", async () => {
    await db.doc("users/carol").set({ bottles: [], pours: [], memories: [], infinityBottles: [] });
    await askSommelier.run({ auth: { uid: "carol" }, data: { prompt: "What's in r1?", context: { screen: "blind", roomId: "r1" } } });
    expect(sentBodies[0].system).toContain("room unavailable");
    expect(sentBodies[0].system).not.toContain("Friday Flight");
  });

  it("applies the existing per-user rate limit", async () => {
    await db.doc("rateLimits/alice_askSommelier").set({ count: 60, windowStart: Date.now() });
    await expect(askSommelier.run({ auth: { uid: "alice" }, data: { prompt: "hi" } })).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(sentBodies).toHaveLength(0);
  });

  it("sends a well-formed Messages API request and returns the reply text", async () => {
    await askSommelier.run({
      auth: { uid: "alice" },
      data: {
        prompt: "And for dessert?",
        history: [
          { role: "assistant", content: "orphan greeting is dropped" },
          { role: "user", content: "Pair something with steak" },
          { role: "assistant", content: "Try a high-rye bourbon." },
          { role: "system", content: "ignored role" },
        ],
        context: { screen: "home" },
      },
    });
    const { url, init } = sentRequests[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.headers["x-api-key"]).toBe(process.env.ANTHROPIC_API_KEY); // from the secret, never the client
    const body = sentBodies[0];
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "system"]);
    expect(typeof body.model).toBe("string");
    expect(body.max_tokens).toBe(500);
    expect(typeof body.system).toBe("string");
    expect(body.messages).toEqual([
      { role: "user", content: "Pair something with steak" },
      { role: "assistant", content: "Try a high-rye bourbon." },
      { role: "user", content: "And for dessert?" },
    ]);
  });

  it("merges consecutive user turns left by a failed send, so roles always alternate", async () => {
    await askSommelier.run({
      auth: { uid: "alice" },
      data: { prompt: "Second try", history: [{ role: "user", content: "First try (no reply)" }], context: { screen: "home" } },
    });
    expect(sentBodies[0].messages).toEqual([{ role: "user", content: "First try (no reply)\n\nSecond try" }]);
  });

  it("falls back gracefully on an empty model reply and maps API errors to an AXE-branded internal error", async () => {
    fetch.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ content: [] }) }));
    const empty = await askSommelier.run({ auth: { uid: "alice" }, data: { prompt: "hi" } });
    expect(empty.reply).toMatch(/couldn't come up with a response/);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementationOnce(async () => ({ ok: false, status: 529, text: async () => "overloaded" }));
    await expect(askSommelier.run({ auth: { uid: "alice" }, data: { prompt: "hi" } })).rejects.toMatchObject({
      code: "internal",
      message: "AXE is unavailable right now.",
    });
    errorSpy.mockRestore();
  });

  it("still answers an older client that sends collectionSummary and no context (cached PWA during rollout)", async () => {
    const result = await askSommelier.run({
      auth: { uid: "alice" },
      data: { prompt: "What should I try?", history: [], collectionSummary: "Spoofed Bottle (fake)" },
    });
    expect(result).toEqual({ reply: "Here's a thought." });
    expect(sentBodies[0].system).toContain("CURRENT SCREEN: the app");
    expect(sentBodies[0].system).toContain("Alice Own Bottle");
    expect(sentBodies[0].system).not.toContain("Spoofed Bottle");
  });
});
