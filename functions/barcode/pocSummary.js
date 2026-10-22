// Summarizes the Phase 0 field test (docs/BARCODE_POC.md): the results a
// tester copied or shared from the Barcode PoC page on their phone. Reads
// only that CSV — no network, no API keys, no cost. Columns are defined in
// web/src/features/barcode/pocResults.ts.
//
// Because each row records what the tester picked and what they had to
// fix against the label in their hand, accuracy is measured directly
// rather than by fuzzy name matching.

function num(value) {
  const n = Number(value);
  return value !== "" && value !== undefined && Number.isFinite(n) ? n : null;
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function pct(n, d) {
  return d ? `${n}/${d} (${Math.round((n / d) * 100)}%)` : "–";
}

function ms(value) {
  return value === null ? "–" : `${Math.round(value)} ms`;
}

function money(value) {
  return value === null ? "–" : `$${value.toFixed(value < 0.1 ? 4 : 2)}`;
}

function deviceOf(ua) {
  if (/iPhone|iPad/.test(ua || "")) return /CriOS|FxiOS/.test(ua) ? "iPhone (other browser)" : "iPhone Safari";
  if (/Android/.test(ua || "")) return "Android";
  return "Other";
}

function fields(row, column) {
  return (row[column] || "").split(" ").filter(Boolean);
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function aiSection(title, rows, origin, msColumn, costColumn) {
  if (rows.length === 0) return [`## ${title}`, "", "Not used.", ""];
  const statusColumn = origin === "axe-barcode" ? "axe_status" : "label_status";
  const identified = rows.filter((r) => r[statusColumn] === "identified");
  const pickedAi = rows.filter((r) => r.picked_from === origin);
  const topChoice = pickedAi.filter((r) => r.picked_axe_rank === "1" && !fields(r, "corrected_fields").includes("name"));
  const latencies = rows.map((r) => num(r[msColumn])).filter((v) => v !== null);
  const costs = rows.map((r) => num(r[costColumn])).filter((v) => v !== null);
  const total = costs.reduce((a, b) => a + b, 0);
  const corrections = countBy(pickedAi.flatMap((r) => fields(r, "corrected_fields").map((f) => ({ f }))), (x) => x.f);
  return [
    `## ${title}`,
    "",
    `- Asked: ${rows.length} · identified something: ${pct(identified.length, rows.length)}`,
    `- Tester picked an AXE suggestion: ${pct(pickedAi.length, rows.length)} · it was AXE's first suggestion with the name right: ${pct(topChoice.length, rows.length)}`,
    `- Fields the tester had to correct on AXE picks: ${corrections.length ? corrections.map(([f, n]) => `${f} ×${n}`).join(", ") : "none"}`,
    `- Latency: median ${ms(percentile(latencies, 0.5))}, p90 ${ms(percentile(latencies, 0.9))}`,
    `- Cost: ${money(costs.length ? total / costs.length : null)} per call, ${money(costs.length ? total : null)} total, ≈ ${money(costs.length ? (total / costs.length) * 1000 : null)} per 1,000`,
    "",
  ];
}

function summarize(rows) {
  const out = [`# Scan Barcode field test — ${rows.length} bottles`, ""];

  out.push("## Scanning", "");
  for (const [device, n] of countBy(rows, (r) => deviceOf(r.device))) out.push(`- ${device}: ${n} bottles`);
  for (const [mode, n] of countBy(rows, (r) => r.scan_mode)) {
    const label = { live: "Live camera", photo: "Decoded from a photo", typed: "Typed (scanner didn't read it)", "label-only": "No barcode (label only)" }[mode] || mode;
    out.push(`- ${label}: ${pct(n, rows.length)}`);
  }
  const live = rows.filter((r) => r.scan_mode === "live");
  const decode = live.map((r) => num(r.ms_to_decode)).filter((v) => v !== null);
  const camera = live.map((r) => num(r.ms_to_camera)).filter((v) => v !== null);
  const rejected = live.reduce((a, r) => a + (num(r.rejected_reads) || 0), 0);
  out.push(
    `- Live decode time: median ${ms(percentile(decode, 0.5))}, p90 ${ms(percentile(decode, 0.9))} · camera start median ${ms(percentile(camera, 0.5))} · misread frames rejected: ${rejected}`,
    "",
  );

  const looked = rows.filter((r) => r.catalog_status);
  const hits = looked.filter((r) => r.catalog_status === "matched");
  const catalogMs = looked.map((r) => num(r.catalog_ms)).filter((v) => v !== null);
  out.push(
    "## FIP catalog (free)",
    "",
    `- Matched: ${pct(hits.length, looked.length)} · median ${ms(percentile(catalogMs, 0.5))}`,
    `- Tester picked a verified bottle: ${rows.filter((r) => r.picked_from === "verified").length} · one they saved before: ${rows.filter((r) => r.picked_from === "yours").length}`,
    "",
  );

  out.push(...aiSection("AXE — barcode", rows.filter((r) => r.axe_used === "yes"), "axe-barcode", "axe_ms", "axe_cost_usd"));
  const labelRows = rows.filter((r) => r.label_used === "yes");
  out.push(...aiSection("AXE — front label", labelRows, "axe-label", "label_ms", "label_cost_usd"));
  const proofChecks = labelRows.filter((r) => r.expected_proof);
  const proofRight = proofChecks.filter((r) => num(r.label_read_proof) !== null && Math.abs(num(r.label_read_proof) - num(r.expected_proof)) <= 0.15);
  const batchChecks = labelRows.filter((r) => r.expected_batch);
  const norm = (v) => String(v || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const batchRight = batchChecks.filter((r) => norm(r.label_read_batch || r.label_read_barrel) === norm(r.expected_batch));
  if (labelRows.length) {
    out.push(`- Read from the label: proof ${pct(proofRight.length, proofChecks.length)} · batch/barrel ${pct(batchRight.length, batchChecks.length)}`, "");
  }

  out.push("## By bottle kind", "", "| Kind | Bottles | Verified | Saved by you | AXE barcode | AXE label | Manual |", "|---|---|---|---|---|---|---|");
  for (const [kind, n] of countBy(rows, (r) => r.variant_kind || "standard")) {
    const subset = rows.filter((r) => (r.variant_kind || "standard") === kind);
    const c = (from) => subset.filter((r) => r.picked_from === from).length;
    out.push(`| ${kind} | ${n} | ${c("verified")} | ${c("yours")} | ${c("axe-barcode")} | ${c("axe-label")} | ${c("manual")} |`);
  }
  out.push("", `Manual entry (nothing offered was right): ${pct(rows.filter((r) => r.picked_from === "manual").length, rows.length)}`, "");
  return out.join("\n");
}

module.exports = { summarize, deviceOf };
