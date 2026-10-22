import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { gradeIdentification, tokens } = require("./grade.js");

const truth = { expectedName: "Example Reserve 10 Year", expectedDistillery: "Example Distilling Co.", variantKind: "standard" };
const found = (overrides = {}) => ({
  identified: true,
  name: "Example Reserve 10 Year Old Kentucky Straight Bourbon",
  brand: "Example Reserve",
  expression: null,
  distillery: "Example Distillery",
  ...overrides,
});

describe("gradeIdentification", () => {
  it("normalizes age statements and ignores filler words", () => {
    expect(tokens("Example 10 Years Old Kentucky Straight Bourbon Whiskey")).toEqual(["example", "10yr", "old"]);
  });

  it("marks a matching name and distillery correct", () => {
    expect(gradeIdentification(truth, found(), found()).verdict).toBe("correct");
  });

  it("marks the right producer with a different expression partial", () => {
    const result = found({ name: "Example Reserve Small Batch", brand: "Example" });
    expect(gradeIdentification(truth, result, result).verdict).toBe("partial");
  });

  it("marks a different product wrong", () => {
    const result = found({ name: "Other Label Rye", brand: "Other", distillery: "Other House" });
    expect(gradeIdentification(truth, result, result).verdict).toBe("wrong");
  });

  it("reports not-found when nothing was identified", () => {
    expect(gradeIdentification(truth, { identified: false }, { identified: false }).verdict).toBe("not-found");
  });

  it("flags a model that asserted one proof for a single barrel or store pick", () => {
    const raw = { ...found(), proof: 117.4, proofVaries: false, upcSharedAcrossVariants: false };
    const graded = gradeIdentification({ ...truth, variantKind: "store-pick" }, found(), raw);
    expect(graded.overclaims).toEqual(["asserted-fixed-proof", "missed-shared-upc"]);
  });

  it("does not flag a fixed proof on a standard release", () => {
    const raw = { ...found(), proof: 90, proofVaries: false };
    expect(gradeIdentification(truth, found(), raw).overclaims).toEqual([]);
  });
});
