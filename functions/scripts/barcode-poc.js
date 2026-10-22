// Scan Barcode Phase 0: Claude vs Gemini on unknown-barcode identification.
// Run by hand from a laptop; never deployed (firebase.json ignores scripts/).
// See docs/BARCODE_POC.md for the full procedure.
//
// Input: the sample CSV exported from the dev Barcode PoC page — one row
// per bottle actually scanned, with the ground truth (what the label says)
// typed in at the time. Optional: a folder of photos saved from that page:
// <gtin13>.jpg (barcode area) for the photo test and <gtin13>-label.jpg
// (front label) for the label test.
//
// Modes: upc   = decoded barcode only
//        photo = barcode photo with the digits withheld
//        label = front-label photo + decoded barcode (Scan Front Label with AXE)
//
// For every row, provider and mode it records the identification, whether
// the guard accepted it, latency, the provider's reported usage, and an
// estimated cost; then grades it against the ground truth and writes:
//   <out>/results.csv   one row per call (with a blank manual_grade column)
//   <out>/summary.md    accuracy, over-claims, latency and cost per provider
//
// Spends real money: it prints a worst-case estimate and makes no call
// unless --confirm-spend is passed. Gemini runs only if GEMINI_API_KEY is
// set (do not create one until the Gemini setup is approved).
//
//   ANTHROPIC_API_KEY=... [GEMINI_API_KEY=...] node scripts/barcode-poc.js \
//     --sample ~/barcode-poc-sample.csv [--photos ~/barcode-photos] \
//     [--claude-models claude-opus-5-5,claude-sonnet-4-6] [--gemini-model gemini-3-flash] \
//     [--modes upc,photo,label] [--limit 5] [--out ./barcode-poc-results] [--confirm-spend]
//
//   GEMINI_API_KEY=... node scripts/barcode-poc.js --list-gemini-models

const fs = require("fs");
const path = require("path");
const { normalizeBarcode } = require("../barcode/gtin");
const { identifyWithClaude, DEFAULT_CLAUDE_MODEL } = require("../barcode/providers/claude");
const { identifyWithGemini, listGeminiModels, DEFAULT_GEMINI_MODEL } = require("../barcode/providers/gemini");
const { gradeIdentification } = require("../barcode/grade");
const { PRICES } = require("../barcode/pricing");

// Generous per-call ceilings used only for the up-front estimate.
const WORST_CASE_PER_CALL = { claude: 0.25, gemini: 0.1 };

function parseArgs(argv) {
  const args = { modes: "upc", out: "./barcode-poc-results", "claude-models": DEFAULT_CLAUDE_MODEL, "gemini-model": DEFAULT_GEMINI_MODEL };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, "");
    if (["confirm-spend", "list-gemini-models"].includes(key)) args[key] = true;
    else args[key] = argv[(i += 1)];
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), (i += 1);
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] || "").trim()])));
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function readPhoto(dir, name) {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const file = path.join(dir, `${name}.${ext}`);
    if (fs.existsSync(file)) {
      const mediaType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return { base64: fs.readFileSync(file).toString("base64"), mediaType, file };
    }
  }
  return null;
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : "–";
}

function money(n) {
  return n === null || n === undefined ? "–" : `$${n.toFixed(n < 0.1 ? 4 : 2)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (args["list-gemini-models"]) {
    if (!geminiKey) throw new Error("Set GEMINI_API_KEY to list Gemini models.");
    console.log((await listGeminiModels(geminiKey)).filter((m) => m.startsWith("gemini")).join("\n"));
    return;
  }
  if (!args.sample) throw new Error("--sample <csv exported from the Barcode PoC page> is required.");

  const sample = parseCsv(fs.readFileSync(args.sample, "utf8"))
    .filter((r) => r.expected_name && !normalizeBarcode(r.gtin13).error)
    .slice(0, args.limit ? Number(args.limit) : undefined);
  const modes = args.modes.split(",").map((m) => m.trim());
  const claudeModels = anthropicKey ? args["claude-models"].split(",").map((m) => m.trim()) : [];
  const providers = [
    ...claudeModels.map((model) => ({ name: "claude", model })),
    ...(geminiKey ? [{ name: "gemini", model: args["gemini-model"] }] : []),
  ];
  if (providers.length === 0) throw new Error("Set ANTHROPIC_API_KEY and/or GEMINI_API_KEY.");

  const jobs = [];
  for (const row of sample) {
    const normalized = normalizeBarcode(row.gtin13);
    for (const mode of modes) {
      const photoName = mode === "label" ? `${normalized.gtin13}-label` : normalized.gtin13;
      const photo = mode !== "upc" && args.photos ? readPhoto(args.photos, photoName) : null;
      if (mode !== "upc" && !photo) continue;
      if (normalized.restricted && mode === "upc") continue;
      for (const provider of providers) jobs.push({ row, normalized, mode, photo, provider });
    }
  }

  const worstCase = jobs.reduce((sum, j) => sum + WORST_CASE_PER_CALL[j.provider.name], 0);
  console.log(`${sample.length} bottles, ${jobs.length} calls (${providers.map((p) => `${p.name}:${p.model}`).join(", ")}; modes: ${modes.join(", ")}).`);
  console.log(`Worst-case estimate: ${money(worstCase)} (Gemini searches priced as if past the free tier).`);
  if (!args["confirm-spend"]) {
    console.log("Dry run — no calls made. Re-run with --confirm-spend to run them.");
    return;
  }

  fs.mkdirSync(args.out, { recursive: true });
  const records = [];
  for (const [index, job] of jobs.entries()) {
    const { row, normalized, mode, photo, provider } = job;
    const label = `[${index + 1}/${jobs.length}] ${provider.name}:${provider.model} ${mode} ${normalized.gtin13}`;
    let call;
    try {
      // The photo test withholds the decoded digits: can the model read the
      // barcode from the picture alone? The label test sends both.
      const input = mode === "photo" ? { normalized: null, photo, mode } : mode === "label" ? { normalized, photo, mode } : { normalized, mode };
      call =
        provider.name === "claude"
          ? await identifyWithClaude({ apiKey: anthropicKey, model: provider.model, ...input })
          : await identifyWithGemini({ apiKey: geminiKey, model: provider.model, ...input });
    } catch (error) {
      call = { error: error.message, result: { identified: false, candidates: [] }, raw: null, latencyMs: null, cost: null, usage: null };
    }
    const grade = gradeIdentification(
      {
        expectedName: row.expected_name,
        expectedDistillery: row.expected_distillery,
        variantKind: row.variant_kind,
        expectedProof: row.expected_proof,
        expectedBatch: row.expected_batch,
      },
      call.result,
      call.raw,
    );
    const top = call.result.candidates?.[0];
    console.log(`${label} → ${call.error ? `ERROR ${call.error}` : `${grade.verdict} ${top?.name || ""} (${grade.candidateCount} candidates)`} (${call.latencyMs ?? "–"} ms, ${money(call.cost?.total)})`);
    records.push({ row, normalized, mode, provider, call, grade });
  }

  const header = [
    "gtin13", "variant_kind", "expected_name", "expected_distillery", "expected_proof", "expected_batch",
    "provider", "model", "mode", "verdict", "rank", "manual_grade", "name_score", "distillery_score", "overclaims", "guard",
    "candidate_count", "candidates", "top_name", "top_release_kind", "top_proof", "upc_shared_across_variants",
    "label_name", "label_proof", "label_batch", "label_barrel", "label_store_pick", "label_proof_correct", "label_batch_correct",
    "confidence", "sources", "latency_ms", "searches", "cost_tokens", "cost_search", "cost_total", "usage_json", "error",
  ];
  const lines = records.map(({ row, normalized, mode, provider, call, grade }) => {
    const r = call.result;
    const top = r.candidates?.[0] || {};
    const l = r.label || {};
    return [
      normalized.gtin13, row.variant_kind, row.expected_name, row.expected_distillery, row.expected_proof, row.expected_batch,
      provider.name, provider.model, mode, grade.verdict, grade.rank, "", grade.nameScore?.toFixed(2), grade.distilleryScore?.toFixed(2),
      grade.overclaims.join(" "), r.guard, grade.candidateCount, (r.candidates || []).map((c) => `${c.name} [${c.releaseKind}]`).join(" | "),
      top.name, top.releaseKind, top.proof, r.upcSharedAcrossVariants,
      l.name, l.proof, l.batch, l.barrel, l.storePick, grade.labelProofCorrect, grade.labelBatchCorrect,
      r.confidence, (r.sources || []).map((src) => src.url).join(" "), call.latencyMs, call.cost?.searches, call.cost?.tokens,
      call.cost?.search, call.cost?.total, JSON.stringify(call.usage), call.error,
    ].map(csvCell).join(",");
  });
  fs.writeFileSync(path.join(args.out, "results.csv"), [header.join(","), ...lines].join("\n"));

  const groups = new Map();
  for (const r of records) {
    const key = `${r.provider.name}:${r.provider.model} · ${r.mode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const summary = [
    "# Scan Barcode Phase 0 — identification results",
    "",
    `${sample.length} bottles · run ${new Date().toISOString()} · prices: Claude ${PRICES.claude.checked}; Gemini ${PRICES.gemini.checked}`,
    "",
    "Verdicts are automatic first-pass grades against the label you recorded; check `partial` and `wrong` rows in results.csv and fill in manual_grade.",
    "",
    "Correct = the right release is the first candidate. In list = offered, but not first (the user can still pick it).",
    "",
    "| Provider · mode | Calls | Correct | In list | Partial | Wrong | Not found | Avg candidates | Over-claims | Errors | Median latency | p90 latency | Avg cost / lookup | Cost / 1,000 lookups |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [key, rs] of groups) {
    const n = rs.length;
    const count = (v) => rs.filter((r) => r.grade.verdict === v && !r.call.error).length;
    const latencies = rs.map((r) => r.call.latencyMs).filter((v) => typeof v === "number");
    const costs = rs.map((r) => r.call.cost?.total).filter((v) => typeof v === "number");
    const avg = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
    const found = rs.filter((r) => r.grade.candidateCount > 0);
    const avgCandidates = found.length ? (found.reduce((a, r) => a + r.grade.candidateCount, 0) / found.length).toFixed(1) : "–";
    summary.push(
      `| ${key} | ${n} | ${pct(count("correct"), n)} | ${pct(count("in-list"), n)} | ${pct(count("partial"), n)} | ${pct(count("wrong"), n)} | ${pct(count("not-found"), n)} | ${avgCandidates} | ${rs.filter((r) => r.grade.overclaims.length).length} | ${rs.filter((r) => r.call.error).length} | ${percentile(latencies, 0.5) ?? "–"} ms | ${percentile(latencies, 0.9) ?? "–"} ms | ${money(avg)} | ${avg === null ? "–" : money(avg * 1000)} |`,
    );
  }
  const byKind = ["standard", "barrel-proof-batch", "single-barrel", "store-pick"];
  const labelRows = records.filter((r) => r.mode === "label");
  if (labelRows.length) {
    const checked = (key) => labelRows.filter((r) => r.grade[key] !== null);
    const right = (key) => checked(key).filter((r) => r.grade[key] === true).length;
    summary.push(
      "",
      "## Read from the front label",
      "",
      `Proof read correctly: ${right("labelProofCorrect")}/${checked("labelProofCorrect").length} · batch or barrel read correctly: ${right("labelBatchCorrect")}/${checked("labelBatchCorrect").length} (bottles where you recorded them).`,
    );
  }
  summary.push("", "## Right release offered (correct or in list) by bottle kind", "", `| Provider · mode | ${byKind.join(" | ")} |`, `|---|${byKind.map(() => "---").join("|")}|`);
  for (const [key, rs] of groups) {
    summary.push(
      `| ${key} | ${byKind
        .map((k) => {
          const subset = rs.filter((r) => r.row.variant_kind === k);
          return subset.length ? `${subset.filter((r) => ["correct", "in-list"].includes(r.grade.verdict)).length}/${subset.length}` : "–";
        })
        .join(" | ")} |`,
    );
  }
  summary.push(
    "",
    "Gemini search cost is shown as if past the monthly free allowance " +
      `(${PRICES.gemini.groundingFreeQueriesPerMonth.toLocaleString()} grounded queries/month on Gemini 3 models); inside it, only the token cost applies.`,
  );
  fs.writeFileSync(path.join(args.out, "summary.md"), summary.join("\n") + "\n");
  console.log(`\nWrote ${path.join(args.out, "results.csv")} and ${path.join(args.out, "summary.md")}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
