import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { gradeIdentification, tokens } = require("./grade.js");

const truth = { expectedName: "Example Reserve 10 Year", expectedDistillery: "Example Distilling Co.", variantKind: "standard" };
const candidate = (overrides = {}) => ({
  name: "Example Reserve 10 Year Old Kentucky Straight Bourbon",
  brand: "Example Reserve",
  expression: null,
  distillery: "Example Distillery",
  ...overrides,
});
const result = (candidates, extra = {}) => ({ identified: true, candidates, ...extra });

describe("gradeIdentification", () => {
  it("normalizes age statements and ignores filler words", () => {
    expect(tokens("Example 10 Years Old Kentucky Straight Bourbon Whiskey")).toEqual(["example", "10yr", "old"]);
  });

  it("marks the right release as the first candidate correct", () => {
    const r = result([candidate()]);
    expect(gradeIdentification(truth, r, r)).toMatchObject({ verdict: "correct", rank: 1, candidateCount: 1 });
  });

  it("marks the right release offered further down the list in-list, with its rank", () => {
    const r = result([candidate({ name: "Example Reserve Small Batch", brand: "Example" }), candidate()]);
    expect(gradeIdentification(truth, r, r)).toMatchObject({ verdict: "in-list", rank: 2, candidateCount: 2 });
  });

  it("marks the right producer with only other releases partial", () => {
    const r = result([candidate({ name: "Example Reserve Small Batch", brand: "Example" })]);
    expect(gradeIdentification(truth, r, r).verdict).toBe("partial");
  });

  it("marks a different product wrong", () => {
    const r = result([candidate({ name: "Other Label Rye", brand: "Other", distillery: "Other House" })]);
    expect(gradeIdentification(truth, r, r).verdict).toBe("wrong");
  });

  it("reports not-found when nothing was identified", () => {
    expect(gradeIdentification(truth, { identified: false }, { identified: false }).verdict).toBe("not-found");
  });

  it("flags a model that asserted one proof or one release for a store pick", () => {
    const raw = { identified: true, candidates: [{ ...candidate(), proof: 117.4, proofVaries: false }], upcSharedAcrossVariants: false };
    const graded = gradeIdentification({ ...truth, variantKind: "store-pick" }, result([candidate()]), raw);
    expect(graded.overclaims).toEqual(["asserted-fixed-proof", "missed-shared-upc"]);
  });

  it("flags any batch or barrel number an AI candidate asserted", () => {
    const raw = { identified: true, candidates: [{ ...candidate(), batch: "C924" }] };
    expect(gradeIdentification(truth, result([candidate()]), raw).overclaims).toEqual(["asserted-batch-or-barrel"]);
  });

  it("does not flag a fixed proof on a standard release", () => {
    const raw = { identified: true, candidates: [{ ...candidate(), proof: 90, proofVaries: false }] };
    expect(gradeIdentification(truth, result([candidate()]), raw).overclaims).toEqual([]);
  });

  it("checks proof and batch read from the label against the recorded label", () => {
    const r = result([candidate()], { label: { proof: 124.6, batch: "C-924" } });
    expect(gradeIdentification({ ...truth, expectedProof: "124.6", expectedBatch: "C924" }, r, r)).toMatchObject({
      labelProofCorrect: true,
      labelBatchCorrect: true,
    });
    expect(gradeIdentification({ ...truth, expectedProof: "120" }, r, r).labelProofCorrect).toBe(false);
    expect(gradeIdentification(truth, r, r).labelProofCorrect).toBeNull();
  });
});
