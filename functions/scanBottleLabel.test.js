// scanBottleLabel ("Scan Label with AXE" on Add Bottle) with the Anthropic
// call stubbed: the prompt asks for the exact expression and for proof,
// batch, barrel and store pick as printed on this label; those come back to
// the app; unreadable or junk answers stay safe.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const { scanBottleLabel } = require("./index.js");

const IMAGE = "A".repeat(400);
let sent;
let reply;

beforeEach(() => {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ content: [{ type: "text", text: reply }] }) };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const scan = (data = { imageBase64: IMAGE, mediaType: "image/jpeg" }, uid = "sl-alice") =>
  scanBottleLabel.run({ auth: uid ? { uid } : undefined, data });

describe("scanBottleLabel", () => {
  it("requires sign-in and a usable photo", async () => {
    await expect(scan(undefined, null)).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(scan({ imageBase64: "x", mediaType: "image/jpeg" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(sent).toHaveLength(0);
  });

  it("asks for the exact expression and the proof, batch, barrel and pick printed on this label", async () => {
    reply = JSON.stringify({ found: true, name: "Elijah Craig Barrel Proof" });
    await scan();
    const system = sent[0].system;
    expect(system).toMatch(/Elijah Craig Barrel Proof/);
    expect(system).toMatch(/"batch"/);
    expect(system).toMatch(/"storePick"/);
    expect(system).toMatch(/never a typical value/);
    expect(sent[0].messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
  });

  it("returns the batch, barrel and store pick it read", async () => {
    reply = JSON.stringify({
      found: true,
      name: "Elijah Craig Barrel Proof",
      distillery: "Heaven Hill",
      type: "Bourbon",
      region: "Kentucky",
      proof: 124.6,
      ageStatement: "12 Year",
      batch: "C924",
      barrel: "",
      storePick: "",
      msrp: 75,
    });
    expect(await scan()).toEqual({
      found: true,
      name: "Elijah Craig Barrel Proof",
      distillery: "Heaven Hill",
      type: "Bourbon",
      region: "Kentucky",
      proof: 124.6,
      ageStatement: "12 Year",
      msrp: 75,
      batch: "C924",
      barrel: "",
      storePick: "",
    });
  });

  it("fills missing fields with empty values and handles fenced JSON", async () => {
    reply = '```json\n{"found": true, "name": "Knob Creek Single Barrel Select", "storePick": "Total Wine"}\n```';
    expect(await scan()).toMatchObject({ found: true, name: "Knob Creek Single Barrel Select", proof: 0, batch: "", barrel: "", storePick: "Total Wine" });
  });

  it("reports not found when no bottle is visible or the answer is junk", async () => {
    reply = JSON.stringify({ found: false });
    expect(await scan()).toEqual({ found: false });
    reply = "I see a cat.";
    expect(await scan()).toEqual({ found: false });
  });
});
