// Live check of Scan Barcode's Google step, run by hand from GitHub Actions
// (.github/workflows/barcode-google-check.yml). Answers "why isn't Google
// identifying this barcode?" against the real, deployed backend:
//
//   1. the switch: appConfig/barcodeGoogle as the function reads it
//   2. this month's estimated spend against the budget
//   3. the deployed lookupBarcode for one UPC, as a dedicated test user:
//      the plain catalog lookup (does it offer Google, and if not, why),
//      then the Google step itself (status, failure reason, model used)
//
// Exits non-zero unless Google identified the bottle. The repository is
// public, so this prints only statuses, counts, categories and the model,
// never what Google said about the bottle (Google's terms limit showing
// grounded results to anyone but the user who asked).
//
// Credentials: Workload Identity Federation, as in axe-smoke-test.js. Cost:
// at most one Gemini call (about $0.01).

const fs = require("fs");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");
const { Firestore } = require("@google-cloud/firestore");
const { normalizeBarcode } = require("../barcode/gtin");
const { sanitize } = require("../barcode/googleConfig");

const PROJECT_ID = "fully-involved-pour";
const FUNCTION_URL = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/lookupBarcode`;
const TEST_UID = "barcode-google-check";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function webApiKey() {
  const source = fs.readFileSync(path.join(__dirname, "../../web/src/data/firebase.ts"), "utf8");
  const match = source.match(/apiKey:\s*'([^']+)'/);
  if (!match) fail("Couldn't find the Firebase web API key in web/src/data/firebase.ts.");
  console.log(`::add-mask::${match[1]}`);
  return match[1];
}

async function idTokenForTestUser(authClient, serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount,
    sub: serviceAccount,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid: TEST_UID,
    claims: { barcodeGoogleCheck: true },
  };
  const signed = await authClient.request({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccount)}:signJwt`,
    method: "POST",
    data: { payload: JSON.stringify(payload) },
  });
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: signed.data.signedJwt, returnSecureToken: true }),
  });
  if (!response.ok) fail(`Test sign-in failed (HTTP ${response.status}).`);
  return (await response.json()).idToken;
}

async function lookup(idToken, data) {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`lookupBarcode returned HTTP ${response.status}: ${body?.error?.status || ""} ${body?.error?.message || ""}`);
  return body.result;
}

function describeConfig(raw) {
  if (!raw) return "missing (Google is off)";
  const types = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? "array" : typeof v]));
  return `${JSON.stringify(sanitize(raw))} (stored field types: ${JSON.stringify(types)})`;
}

async function main() {
  const upc = (process.env.UPC || "082184009017").trim();
  const normalized = normalizeBarcode(upc);
  if (normalized.error) fail(`${upc} isn't a valid UPC/EAN.`);
  const serviceAccount = process.env.GCP_SERVICE_ACCOUNT;
  if (!serviceAccount) fail("GCP_SERVICE_ACCOUNT isn't set.");
  const authClient = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
  const db = new Firestore({ projectId: PROJECT_ID });

  const config = await db.doc("appConfig/barcodeGoogle").get();
  console.log(`1. appConfig/barcodeGoogle: ${describeConfig(config.exists ? config.data() : null)}`);
  const month = new Date().toISOString().slice(0, 7);
  const spend = await db.doc(`aiSpend/gemini-${month}`).get();
  const s = spend.exists ? spend.data() : {};
  console.log(`2. Gemini spend ${month}: ${s.calls || 0} call(s), ${s.searchQueries || 0} search(es), about $${(s.estimatedUsd || 0).toFixed(4)} estimated`);

  const idToken = await idTokenForTestUser(authClient, serviceAccount);
  const plain = await lookup(idToken, { barcode: upc });
  console.log(`3. Catalog lookup for ${upc} (GTIN ${normalized.gtin13}): status=${plain.status}, googleAvailable=${plain.googleAvailable}, googleStatus=${plain.googleStatus ?? "(not reported — old function deployed)"}`);
  if (plain.status === "matched") console.log("   The catalog already knows this barcode, so the app won't ask Google for it.");

  const withGoogle = await lookup(idToken, { barcode: upc, useGoogle: true });
  const g = withGoogle.google || {};
  const result = g.result || {};
  const candidates = result.candidates || [];
  console.log(
    `4. Google step: status=${g.status}${g.reason ? `, reason=${g.reason}` : ""}, model=${g.model || "-"}, latency=${g.latencyMs ?? "-"} ms, cost=$${g.costUsd ?? "-"}`,
  );
  if (g.status === "identified" || g.status === "not-found") {
    console.log(
      `   ${candidates.length} candidate(s); categories: ${[...new Set(candidates.map((c) => c.category || "?"))].join(", ") || "-"}; release kinds: ${candidates.map((c) => c.releaseKind).join(", ") || "-"}; ${(result.sources || []).length} source link(s); Search Suggestions ${g.searchEntryPoint ? "present" : "missing"}; confidence ${result.confidence}`,
    );
  }
  if (g.status !== "identified") fail(`Google did not identify ${upc}: ${g.status}${g.reason ? ` (${g.reason})` : ""}. See the function logs step for details.`);
  console.log("Google identified the bottle.");
}

main().catch((err) => fail(`Check crashed: ${err && err.message ? err.message : String(err)}`));
