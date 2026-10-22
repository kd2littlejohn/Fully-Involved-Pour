import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { summarize, deviceOf } = require("./pocSummary.js");
const { parseCsv } = require("./csv.js");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1";
const row = (overrides) => ({
  device: IPHONE,
  scan_mode: "live",
  ms_to_decode: "600",
  ms_to_camera: "300",
  rejected_reads: "0",
  catalog_status: "no-match",
  catalog_ms: "150",
  axe_used: "no",
  label_used: "no",
  picked_from: "manual",
  picked_axe_rank: "",
  corrected_fields: "",
  variant_kind: "standard",
  expected_proof: "",
  expected_batch: "",
  ...overrides,
});

describe("field test summary", () => {
  const rows = [
    row({ catalog_status: "matched", picked_from: "verified" }),
    row({ axe_used: "yes", axe_status: "identified", axe_ms: "6000", axe_cost_usd: "0.06", picked_from: "axe-barcode", picked_axe_rank: "1" }),
    row({ axe_used: "yes", axe_status: "identified", axe_ms: "8000", axe_cost_usd: "0.08", picked_from: "axe-barcode", picked_axe_rank: "2", corrected_fields: "name proof", variant_kind: "barrel-proof-batch" }),
    row({
      scan_mode: "typed",
      label_used: "yes",
      label_status: "identified",
      label_ms: "9000",
      label_cost_usd: "0.1",
      label_read_proof: "124.6",
      label_read_batch: "C924",
      expected_proof: "124.6",
      expected_batch: "C-924",
      picked_from: "axe-label",
      picked_axe_rank: "1",
      variant_kind: "barrel-proof-batch",
    }),
  ];
  const text = summarize(rows);

  it("reports scanning by device and how each bottle was captured", () => {
    expect(text).toContain("- iPhone Safari: 4 bottles");
    expect(text).toContain("- Live camera: 3/4 (75%)");
    expect(text).toContain("- Typed (scanner didn't read it): 1/4 (25%)");
    expect(text).toContain("Live decode time: median 600 ms");
  });

  it("measures AXE directly from what the tester picked and fixed", () => {
    expect(text).toContain("Tester picked an AXE suggestion: 2/2 (100%) · it was AXE's first suggestion with the name right: 1/2 (50%)");
    expect(text).toContain("Fields the tester had to correct on AXE picks: name ×1, proof ×1");
    expect(text).toContain("$0.0700 per call, $0.14 total");
  });

  it("checks what AXE read from the label against the confirmed bottle", () => {
    expect(text).toContain("Read from the label: proof 1/1 (100%) · batch/barrel 1/1 (100%)");
  });

  it("breaks results down by bottle kind", () => {
    expect(text).toContain("| barrel-proof-batch | 2 | 0 | 0 | 1 | 1 | 0 |");
    expect(text).toContain("FIP catalog (free)");
    expect(text).toContain("- Matched: 1/4 (25%)");
  });

  it("recognizes phones from the browser string", () => {
    expect(deviceOf(IPHONE)).toBe("iPhone Safari");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 15) Chrome/141")).toBe("Android");
  });

  it("parses the CSV the phone exports", () => {
    expect(parseCsv('expected_name,device\n"Example, ""Pick""",x\n')).toEqual([{ expected_name: 'Example, "Pick"', device: "x" }]);
  });
});
