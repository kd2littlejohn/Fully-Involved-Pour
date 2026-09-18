import { describe, expect, it, vi } from "vitest";
import rarityLogic from "./rarityLogic.js";

const { buildRarityPrompt, sanitizeRaritySuggestion, handleSuggestBottleRarity } = rarityLogic;

function fakeDeps(overrides) {
  return {
    callClaude: vi.fn().mockResolvedValue(JSON.stringify({ rarity: "allocated", confidence: "high", reason: "Usually released via store lottery.", normalizedBottleName: "Test Bottle" })),
    assertNotRateLimited: vi.fn().mockResolvedValue(undefined),
    apiKey: () => "fake-key",
    now: () => 1000,
    ...overrides,
  };
}

describe("buildRarityPrompt", () => {
  it("builds a fact list and never includes a price/msrp field", () => {
    const { prompt } = buildRarityPrompt({ bottleName: "Eagle Rare 10", distillery: "Buffalo Trace", type: "Bourbon", proof: 90 });
    expect(prompt).toContain("Eagle Rare 10");
    expect(prompt).toContain("Buffalo Trace");
    expect(prompt).toContain("Bourbon");
    expect(prompt).toContain("90");
    expect(prompt.toLowerCase()).not.toContain("price");
    expect(prompt.toLowerCase()).not.toContain("msrp");
  });

  it("rejects a missing or too-short bottle name", () => {
    expect(() => buildRarityPrompt({ bottleName: "" })).toThrow(/name is required/i);
    expect(() => buildRarityPrompt({ bottleName: "AB" })).toThrow(/name is required/i);
  });

  it("drops an out-of-range proof rather than passing it through", () => {
    const { prompt } = buildRarityPrompt({ bottleName: "Test Bottle Name", proof: 999 });
    expect(prompt).not.toContain("999");
  });
});

describe("sanitizeRaritySuggestion", () => {
  it("returns a valid structured suggestion for well-formed model output", () => {
    const result = sanitizeRaritySuggestion(
      JSON.stringify({ rarity: "rare", confidence: "high", reason: "Very limited annual release.", normalizedBottleName: "Test Bottle" }),
      1000,
    );
    expect(result).toEqual({
      rarity: "rare",
      confidence: "high",
      reason: "Very limited annual release.",
      normalizedBottleName: "Test Bottle",
      generatedAt: 1000,
      classifierVersion: "rarity-v1",
    });
  });

  it("rejects an invalid rarity value", () => {
    for (const bad of ["legendary", "Rare!", 42, undefined, "very rare"]) {
      const result = sanitizeRaritySuggestion(JSON.stringify({ rarity: bad, confidence: "high", reason: "x" }), 1000);
      expect(result.rarity).toBeNull();
    }
    const good = sanitizeRaritySuggestion(JSON.stringify({ rarity: "common", confidence: "high", reason: "Widely available." }), 1000);
    expect(good.rarity).toBe("common");
  });

  it("clamps an invalid confidence to low", () => {
    const result = sanitizeRaritySuggestion(JSON.stringify({ rarity: "common", confidence: "extremely sure", reason: "x" }), 1000);
    expect(result.confidence).toBe("low");
  });

  it("returns rarity null when the classifier declines or cannot place the bottle", () => {
    const declined = sanitizeRaritySuggestion(JSON.stringify({ rarity: null, confidence: "low", reason: "Not a recognized product." }), 1000);
    expect(declined.rarity).toBeNull();
  });

  it("forces rarity null when a non-null rarity has no stated reason", () => {
    const result = sanitizeRaritySuggestion(JSON.stringify({ rarity: "rare", confidence: "high", reason: "" }), 1000);
    expect(result.rarity).toBeNull();
  });

  it("a low-confidence suggestion with a real, reasoned rarity survives (not forced null)", () => {
    const result = sanitizeRaritySuggestion(
      JSON.stringify({ rarity: "uncommon", confidence: "low", reason: "Availability varies regionally, but generally findable." }),
      1000,
    );
    expect(result.rarity).toBe("uncommon");
    expect(result.confidence).toBe("low");
  });

  it("handles malformed output safely: empty string, plain text, fenced JSON, arrays, null", () => {
    for (const raw of ["", "not json at all", "```json\n{\"rarity\":\"rare\",\"confidence\":\"high\",\"reason\":\"x\"}\n```", "[]", "null", "undefined"]) {
      expect(() => sanitizeRaritySuggestion(raw, 1000)).not.toThrow();
      const result = sanitizeRaritySuggestion(raw, 1000);
      expect(result.classifierVersion).toBe("rarity-v1");
      expect(["common", "uncommon", "allocated", "rare", "unicorn", null]).toContain(result.rarity);
    }
    // The one fenced-but-valid case should actually parse through, not decline.
    const fenced = sanitizeRaritySuggestion('```json\n{"rarity":"rare","confidence":"high","reason":"Very limited."}\n```', 1000);
    expect(fenced.rarity).toBe("rare");
  });
});

describe("handleSuggestBottleRarity", () => {
  it("returns a structured suggestion for a valid, authenticated request", async () => {
    const deps = fakeDeps();
    const result = await handleSuggestBottleRarity({ auth: { uid: "u1" }, data: { bottleName: "Test Bottle", distillery: "Test Distillery" } }, deps);
    expect(result.rarity).toBe("allocated");
    expect(result.confidence).toBe("high");
    expect(deps.callClaude).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated request without calling the rate limiter or the model", async () => {
    const deps = fakeDeps();
    await expect(handleSuggestBottleRarity({ auth: null, data: { bottleName: "Test Bottle" } }, deps)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(deps.assertNotRateLimited).not.toHaveBeenCalled();
    expect(deps.callClaude).not.toHaveBeenCalled();
  });

  it("calls the rate limiter with the expected operation name and a raised cap, before calling the model", async () => {
    const deps = fakeDeps();
    await handleSuggestBottleRarity({ auth: { uid: "u1" }, data: { bottleName: "Test Bottle" } }, deps);
    expect(deps.assertNotRateLimited).toHaveBeenCalledWith("u1", "suggestBottleRarity", { maxCalls: 100 });
  });

  it("propagates a rate-limit rejection without calling the model", async () => {
    const { HttpsError } = await import("firebase-functions/v2/https");
    const deps = fakeDeps({ assertNotRateLimited: vi.fn().mockRejectedValue(new HttpsError("resource-exhausted", "slow down")) });
    await expect(handleSuggestBottleRarity({ auth: { uid: "u1" }, data: { bottleName: "Test Bottle" } }, deps)).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(deps.callClaude).not.toHaveBeenCalled();
  });

  it("handles malformed model output safely end-to-end (never throws, always a valid suggestion)", async () => {
    const deps = fakeDeps({ callClaude: vi.fn().mockResolvedValue("not valid json") });
    const result = await handleSuggestBottleRarity({ auth: { uid: "u1" }, data: { bottleName: "Test Bottle" } }, deps);
    expect(result.rarity).toBeNull();
    expect(typeof result.reason).toBe("string");
  });
});
