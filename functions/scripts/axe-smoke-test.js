// Live AXE smoke test, run by .github/workflows/deploy-functions.yml right
// after askSommelier deploys. Exercises the real, deployed, secured backend
// end to end (Firebase Auth ID token → callable → Firestore → Anthropic)
// as a dedicated test user whose data this script seeds itself, so no real
// user's data is read or touched.
//
// Credentials: Application Default Credentials from Workload Identity
// Federation (google-github-actions/auth). No keys live in this repo, and
// no token or key is ever printed. The Firebase web API key read below is a
// public client identifier (it ships in the website), masked anyway.
//
// Cost: two model calls per run (max 500 output tokens each).

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const PROJECT_ID = "fully-involved-pour";
const REGION = "us-central1";
const TEST_UID = "axe-smoke-test";
const BOTTLE_ID = "axe-smoke-bottle";
const FUNCTION_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/askSommelier`;

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

// Known, fixed history: one owned bottle with one distinctive tasting note.
const SEEDED_DOC = {
  username: "axe_smoke_test",
  bottles: [{ id: BOTTLE_ID, name: "Eagle Rare 10 Year", distillery: "Buffalo Trace", type: "Bourbon", proof: 90, status: "open" }],
  pours: [
    {
      id: "axe-smoke-pour",
      bottleId: BOTTLE_ID,
      date: "2026-09-01",
      rating: 8.4,
      notes: "Dark cherry and saddle leather up front, long warm finish.",
      fip: { nose: 2, palate: 3, finish: 1.5, complexity: 1, value: 0.9, total: 8.4, noseAromas: ["Cherry"], palateFlavors: ["Leather"] },
    },
  ],
  memories: [],
  infinityBottles: [],
  customLibrary: [],
  people: [],
};

async function idTokenForTestUser(apiKey) {
  const customToken = await admin.auth().createCustomToken(TEST_UID, { axeSmokeTest: true });
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!response.ok) fail(`Test sign-in failed (HTTP ${response.status}).`);
  const { idToken } = await response.json();
  if (!idToken) fail("Test sign-in returned no ID token.");
  return idToken;
}

async function askAxe(idToken, prompt, context) {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data: { prompt, history: [], context } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`askSommelier returned HTTP ${response.status}: ${body?.error?.status || "unknown"} ${body?.error?.message || ""}`);
  const reply = body?.result?.reply;
  if (typeof reply !== "string" || !reply.trim()) fail("askSommelier returned an empty reply.");
  return reply;
}

async function main() {
  const serviceAccountId = process.env.GCP_SERVICE_ACCOUNT;
  if (!serviceAccountId) fail("GCP_SERVICE_ACCOUNT isn't set.");
  // serviceAccountId lets the Admin SDK sign the custom token via the IAM
  // signBlob API, since keyless WIF credentials have no private key.
  admin.initializeApp({ projectId: PROJECT_ID, serviceAccountId });

  await admin.firestore().doc(`users/${TEST_UID}`).set({ ...SEEDED_DOC, updatedAt: Date.now() });
  const idToken = await idTokenForTestUser(webApiKey());

  // 1. Identifies an owned bottle and uses the user's real tasting history.
  const bottleReply = await askAxe(idToken, "What did I think of this bottle last time?", { screen: "bottle", bottleId: BOTTLE_ID });
  console.log(`Bottle reply: ${bottleReply}`);
  if (!/cherry|leather/i.test(bottleReply)) {
    fail("AXE didn't use the seeded tasting note (expected it to mention cherry or leather).");
  }

  // 2. Thin palate data: must not invent a flavor preference.
  const palateReply = await askAxe(idToken, "Which flavors do I prefer most?", {
    screen: "palate",
    palate: {
      pourCount: 1,
      qualifyingPourCount: 1,
      hasBaseline: false,
      maturity: "learning",
      summary: "You've logged 1 pour so far, averaging 8.4 — Working Fire.",
      experiencedFlavors: [],
      preferredFlavors: [],
      patterns: [],
      trends: [],
    },
  });
  console.log(`Palate reply: ${palateReply}`);
  if (!/(not enough|too (few|early)|only (one|1)|just (one|1)|more (pours|tastings|data)|yet)/i.test(palateReply)) {
    fail("With one pour on record, AXE should say there isn't enough data for a preference.");
  }

  console.log("AXE smoke test passed.");
}

main().catch((err) => fail(`Smoke test crashed: ${err && err.message ? err.message : String(err)}`));
