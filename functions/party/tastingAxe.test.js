// Pure checks for the in-tasting AXE (tastingAxe.js): which experience a
// caller gets, what the prompt may contain, and the blind reply filter.
import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildTastingPrompt, revealsConcealed, tastingMode } = require("./tastingAxe");

const concealed = [
  { name: "Weller Antique 107", distillery: "Buffalo Trace Distillery", proof: 107 },
  { name: "Elijah Craig Barrel Proof Rye", distillery: "Heaven Hill Distillery" },
  { name: "Old Forester 1920", distillery: "Brown-Forman", age: "4 Years" },
];

describe("tastingMode", () => {
  const category = { state: "voting_open" };
  it("uses the guest record's group in a dual event, defaulting to blind", () => {
    expect(tastingMode({ party: { format: "dual" }, guest: { group: "guided" }, isAdmin: false, category })).toBe("guided");
    expect(tastingMode({ party: { format: "dual" }, guest: { group: "blind" }, isAdmin: true, category })).toBe("blind");
    expect(tastingMode({ party: { format: "dual" }, guest: {}, isAdmin: false, category })).toBe("blind");
    expect(tastingMode({ party: { format: "dual" }, guest: null, isAdmin: true, category })).toBe("guided");
  });
  it("keeps a blind party blind for everyone until the reveal", () => {
    expect(tastingMode({ party: { format: "blind" }, guest: null, isAdmin: true, category })).toBe("blind");
    expect(tastingMode({ party: { format: "blind" }, guest: {}, isAdmin: false, category: { state: "revealed" } })).toBe("guided");
    expect(tastingMode({ party: { format: "regular" }, guest: {}, isAdmin: false, category })).toBe("guided");
  });
});

describe("buildTastingPrompt", () => {
  const party = { name: "Proof of Graduation" };
  const category = { name: "Flight 1 — Wheated Bourbon", description: "", sampleLabels: ["A", "B", "C"] };
  it("never includes a bottle in blind mode, even when bottles are passed in", () => {
    const { system, data } = buildTastingPrompt({ party, category, label: "B", mode: "blind", bottles: { B: concealed[0] }, myBallot: null });
    expect(data).not.toContain("Weller");
    expect(system).toMatch(/Never name, suggest or hint/);
  });
  it("lists the flight's bottles in guided mode", () => {
    const { data } = buildTastingPrompt({ party, category, label: "B", mode: "guided", bottles: { B: concealed[0] }, myBallot: null });
    expect(data).toContain("Weller Antique 107 (Buffalo Trace Distillery, 107 proof)");
  });
});

describe("revealsConcealed", () => {
  it("catches brand words, distilleries, phrases, proofs and age statements", () => {
    for (const reply of [
      "This could be a Weller.",
      "Classic buffalo trace sweetness.",
      "It's Elijah Craig, I think.",
      "Around 107 here.",
      "Feels like a 4-year whiskey.",
      "That one drinks like 115 proof.",
      "Maybe 58% ABV.",
      "A Heaven Hill rye, probably.",
    ]) {
      expect(revealsConcealed(reply, concealed), reply).toBe(true);
    }
  });
  it("lets neutral guidance through", () => {
    for (const reply of [
      "Look for caramel, vanilla and baking spice.",
      "Rye grain often brings pepper and dill on the palate.",
      "Higher proof can numb the palate, so add a drop of water.",
      "Compare the finish of glass A and glass B.",
      "Barrel char gives oak and smoke.",
    ]) {
      expect(revealsConcealed(reply, concealed), reply).toBe(false);
    }
  });
});
