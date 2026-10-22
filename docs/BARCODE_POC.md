# Scan Barcode — Phase 0 proof of concept

Status: **Phase 0, development only.** Nothing here is visible to users. The
production website build is byte-identical to `main`: the PoC page, its
route and the ZXing decoder are compiled out. Nothing has been deployed.
Gemini is not enabled anywhere.

Goal: decide, with measurements, how FIP should identify a bottle from its
barcode before building the production Scan Barcode button on Add Bottle.

## What Phase 0 contains

| Piece | Where | What it does |
|---|---|---|
| On-device decoder | `web/src/features/barcode/decoder.ts` | Camera scanning and still-photo decoding of **UPC-A, UPC-E and EAN-13 only**, entirely on the phone. Uses the browser's built-in `BarcodeDetector` where it supports those formats (Chrome on Android) and free, Apache-2.0 **ZXing** (`@zxing/browser` 0.2.1) everywhere else, including iPhone Safari. ZXing is lazy-loaded, so its code only downloads when someone scans. |
| Barcode validation | `web/src/features/barcode/gtin.ts`, `functions/barcode/gtin.js` | Check digit, UPC-E → UPC-A expansion, one GTIN-13 key per product. Flags store-applied labels (UPC 2/4, EAN 2x), e.g. a store's own sticker on a store pick, so they are never looked up as products. Client and server share test vectors. |
| ZXing UPC-E fix | `web/src/features/barcode/zxingUpcEFix.ts` | `@zxing/library` 0.23.0 cannot decode UPC-E at all (see Findings). Small, tested patch. A test fails when upstream fixes it, at which point the patch can be deleted. |
| Lookup callable | `functions/barcode/lookup.js` → `lookupBarcode` | Order: **administrator-verified mapping → this user's own confirmation → Claude + web search**. AI is only ever the last step, is rate-limited (20/user/hour), and its answer is returned, not stored. |
| Result guard | `functions/barcode/identify.js` | Enforced in code, not just in the prompt. An answer only counts as identified if it **cites a web source**. A proof is dropped whenever the model says it varies or the UPC is shared across variants. No batch, barrel, store-pick or release fields exist in the schema. |
| Firestore rules | `firestore.rules` | `upcMappings/{gtin13}`: administrator-verified, readable by signed-in users, **no client writes**. `upcConfirmations/{gtin13}/confirmedBy/{uid}`: one user's own confirmation, **private to that user**, fixed field list (no batch/barrel/store/price). |
| Dev PoC page | `web/src/pages/Dev/BarcodePocPage.tsx`, route `#/dev/barcode` | Dev server only. Scan, decode a photo or type digits. Shows timing, the confirmation screen (name, distillery, expression, proof, size, image; missing fields say "Not found"), corrections, and ground-truth recording with CSV export for the 30-bottle test. |
| Comparison script | `functions/scripts/barcode-poc.js` | Runs the recorded sample through Claude and (once approved) Gemini, in two modes: **decoded UPC** and **barcode photo with the digits withheld**. Grades against the label you recorded and writes `results.csv` and `summary.md`. Makes no calls without `--confirm-spend`. |

The existing Add Bottle, My Bar, Wishlist, AXE and inventory data model are
untouched.

## Findings so far (measured in this environment)

These cover the **decoder only**. Identification accuracy, real-phone
camera behaviour, AI latency and AI cost still need the 30-bottle run
below, which needs real bottles, real phones and API keys.

### 1. ZXing cannot decode UPC-E (fixed)

`@zxing/library` 0.23.0 (the current release) never returns a UPC-E code.
There are three bugs in its JavaScript port:

- `decodeMiddle` returns a number where `decodeRow` expects `{rowOffset, resultString}`, so the digits are lost.
- `decodeRow` calls the EAN-13 end guard and checksum statically, ignoring UPC-E's own.
- `convertUPCEtoUPCA` compares character codes to numbers.

iPhone Safari has no built-in detector, so without the fix iPhones would
never scan UPC-E (used on small packages such as 50 ml bottles). After the
fix: 10/10 UPC-E decoded in every clean condition and on the live camera.

### 2. Synthetic decode benchmark (ZXing, real Chromium, 40 codes per condition)

The test used 20 UPC-A, 10 EAN-13 and 10 UPC-E codes, rendered in-browser
and run through the app's own `decodeImageFile`:

| Condition | Decoded | Wrong code | Median time |
|---|---|---|---|
| Clean | 40/40 | 0 | 8 ms |
| Rotated 10° / 30° / 180° | 40/40 each | 0 | 7–8 ms |
| Slight blur | 40/40 | 0 | 8 ms |
| Short (truncated) bars | 40/40 | 0 | 5 ms |
| JPEG quality 0.35 | 40/40 | 0 | 7 ms |
| Curved label (round bottle) | 31/40 | 0 | 12 ms |
| Far away, 1.4 px per bar module | 23/40 | 0 | 5 ms |
| Glare spot over half the code | 37/40 | **3** | 19 ms |
| Heavy blur | 0/40 | 0 | 105 ms |
| Dim light with heavy noise | 0/40 | 0 | 131 ms |

**Glare can produce a wrong code.** With the right half of an EAN-13
washed out, ZXing read the left half as a different, check-digit-valid
UPC-E. Reference ZXing (Java) has the same weakness. Mitigations already in
place:

- Live scanning requires two identical consecutive reads, and **three for UPC-E**.
- The confirmation screen shows the digits as printed, so they can be compared with the label.
- An unknown code returns "not found" rather than a guess.

Heavy blur and very dim light fail cleanly: no wrong code, the user just
moves closer or uses Decode a photo or manual entry.

### 3. Live camera path (fake webcam in Chromium, 1280×720, 15 fps)

The test pressed the real Scan Barcode button with a video feed:

| Feed | Result | Time to decode |
|---|---|---|
| UPC-A, steady | correct | 536 ms |
| EAN-13, steady | correct | 530 ms |
| UPC-E, steady | correct | 1,049 ms (third confirming read) |
| UPC-A, handheld wobble + noise | correct | 544 ms |
| UPC-A, moving glare | correct | 590 ms |
| EAN-13, soft focus | correct | 596 ms |

Camera start-up was about 0.2–0.25 s here. Real phones will differ, which is
what the device test below measures.

## Running the 30-bottle test

### Step 1: scan on real phones (no AI, no cost)

The camera needs HTTPS, so the dev server needs a certificate. This uses
only OpenSSL, nothing to install:

```sh
cd web
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=fip-dev" \
  -keyout ~/fip-dev-key.pem -out ~/fip-dev-cert.pem
FIP_DEV_HTTPS_CERT=~/fip-dev-cert.pem FIP_DEV_HTTPS_KEY=~/fip-dev-key.pem npm run dev
```

On each phone (same Wi-Fi), open `https://<laptop-ip>:5173/#/dev/barcode`
and accept the certificate warning once. Test **iPhone Safari**, the
**iPhone home-screen app**, and **Android Chrome** (once with *Auto*, once
with *ZXing* forced).

For each of the 30 bottles:

1. Tap **Scan Barcode**, or use **Decode a photo** if live scanning struggles. Note which one worked.
2. Type the **actual bottle and distillery from the label**, and pick the kind: standard release, barrel-proof batch, single barrel or store pick. Aim for at least 5 of each non-standard kind.
3. **Record this scan.** For the photo test, also tap **Save photo for the AI photo test**. It saves `<gtin13>.jpg`, downscaled.

Then **Export CSV**. The page shows decode time, camera start-up time and
rejected (misread) frames for each scan.

### Step 2: identification comparison (costs money, needs keys)

```sh
cd functions
# Dry run: prints the number of calls and a worst-case cost; makes no calls.
ANTHROPIC_API_KEY=… node scripts/barcode-poc.js --sample ~/barcode-poc-sample.csv \
  --photos ~/barcode-photos --modes upc,photo --claude-models claude-opus-5-5,claude-sonnet-4-6
# Real run:
ANTHROPIC_API_KEY=… node scripts/barcode-poc.js … --confirm-spend
```

- `claude-sonnet-4-6` is the model FIP's other AI features use today. `claude-opus-5-5` is the current model. Running both shows whether the cheaper one is accurate enough.
- After approval, add `GEMINI_API_KEY=…` (and `--gemini-model`, checked with `--list-gemini-models`) and the same command runs Gemini side by side.
- 30 bottles × 2 modes × 2 Claude models is 120 calls, worst case about $30, expected well under $10. Adding Gemini is 60 more calls; its search queries fall inside its free monthly allowance.

The output `summary.md` shows correct / partial / wrong / not-found,
over-claims (asserting a single proof or missing a shared UPC on
batch/barrel/store-pick bottles), median and p90 latency, and measured
cost per lookup and per 1,000 lookups, for each provider and mode.
`results.csv` has a blank `manual_grade` column for checking anything the
automatic grader marked partial or wrong.

### Step 3: end-to-end flow (optional, emulators)

To try lookup → confirm → "your confirmation" on a second scan without
deploying anything:

```sh
echo "ANTHROPIC_API_KEY=…" > functions/.secret.local
firebase emulators:start --only auth,firestore,functions
VITE_FIREBASE_EMULATORS=true npm run dev   # in web/
```

## Gemini with Google Search grounding: what enabling it involves

**Not enabled. No key created, nothing configured.** The code path exists
(`functions/barcode/providers/gemini.js`), but only the script uses it, and
only when `GEMINI_API_KEY` is set.

**Existing infrastructure.** FIP has no Firebase AI Logic or Gemini setup
today. All FIP AI runs on Anthropic Claude through Cloud Functions. Firebase
AI Logic's web SDK does support Grounding with Google Search
(`tools: [{ googleSearch: {} }]`), and `firebase/ai` already ships inside the
`firebase` package FIP uses, so no new library is needed. It is still a new
service to enable.

**Ways to wire it, if approved:**

| Option | Setup | Notes |
|---|---|---|
| A. Gemini Developer API key, called from the existing Cloud Function | Create a key in Google AI Studio on the FIP Google Cloud project; store it as a Functions secret (`GEMINI_API_KEY`) | Fits FIP's current pattern: server-side, rate limited, cache checked first. **Recommended if Gemini wins.** This is also what the comparison script uses. |
| B. Firebase AI Logic (client SDK) | Console → AI Logic → enable, choose the Gemini Developer API backend; turn on **App Check** | Calls go from the browser, so the cache-first order and rate limits would have to move client-side or depend on App Check. |
| C. Vertex AI Gemini from the Cloud Function | Enable the Vertex AI API; the function's service account authenticates, so no key is needed | Same pricing model; more Google Cloud setup. |

**Pricing.** Google's pricing pages are blocked from this environment's
network, so these figures come from several third-party trackers that
agree. **Verify them on ai.google.dev/gemini-api/docs/pricing before
approving.**

- Gemini 3 Flash: about $0.50 per 1M input tokens and $3.00 per 1M output tokens (including thinking).
- Grounding on Gemini 3 models: **5,000 search queries per month free**, shared across Gemini 3 models, then **$14 per 1,000 search queries**. One prompt can run several queries.
- Gemini 2.5 models are billed per grounded prompt instead (reportedly 1,500 per day free, then $35 per 1,000).
- The free allowance is per billing account, and the project already bills Cloud Functions, so usage past the allowance is charged automatically. Set a **budget alert** first.

**Terms that affect FIP's design.** These come from Google's grounding
documentation and secondary summaries; the terms text itself should be read
before production.

- Wherever a grounded answer is shown, the **Google Search Suggestions** element returned with it must be shown too, unmodified and linking straight to Google. That's a visible UI requirement on FIP's confirmation screen.
- Summaries of the terms say grounded results may be shown only to the user who asked, and may **not be cached or stored**. That conflicts with "cache verified UPC mappings" if the stored facts came from Gemini. The current design stores only what the user confirms or corrects, and administrator-verified mappings, never the raw AI answer. Whether a user-confirmed mapping derived from a grounded answer can be kept and shared needs a read of the Gemini API Additional Terms before production.
- Claude's web search has a per-search price ($10 per 1,000 searches, plus result tokens) and no such display requirement. No comparable storage restriction was found, but its terms should also be checked before production.

## Cost picture (to be replaced by measured numbers)

| Event | Expected cost |
|---|---|
| Decode (ZXing or built-in) | $0 |
| Barcode already verified, or already confirmed by this user | 1–2 Firestore reads, effectively $0 |
| Unknown barcode, Claude Opus 5.5 + web search | about $0.04–0.10 per lookup (tokens ~$4/$20 per 1M plus $0.01 per search, up to 3 searches) |
| Unknown barcode, Claude Sonnet 4.6 + web search | similar order, measured by the script |
| Unknown barcode, Gemini 3 Flash + grounding | tokens about $0.005–0.02; searches $0 within 5,000/month, then about $0.014 each |

Every barcode costs AI money at most once per user, because the next scan
hits their confirmation. Once an administrator verifies a mapping, it costs
$0 for every user.

## Decisions this needs from you

1. **Approve Gemini setup for the comparison** (option A above, AI Studio key, budget alert). The 30-bottle Claude run can happen first without it.
2. **Run the 30-bottle test** (steps 1–2). Phone testing has to be done on your devices.
3. Before production: read the grounding storage terms if Gemini wins.

## Phase 1 (production): planned, not started

- A prominent **Scan Barcode** card on Add Bottle's entry screen (beside Scan Label with AI and Manual Entry), and a Scan Barcode button under the bottle name field in the form. Same card and button styles.
- Confirmation screen as in the PoC, with the Search Suggestions element if Gemini is used. **Use these details** prefills the existing Add Bottle form, then the existing save path. Wishlist uses the existing status field. No inventory model change.
- **Already in My Bar → Increase Quantity:** a confirmation can store the `bottleId` it was saved as (the field is already allowed by the rules and returned by `lookupBarcode`). The next scan of that barcode offers *Increase Quantity* on that bottle, adding a new sealed instance through the existing multi-bottle logic, instead of creating a duplicate.
- An administrator review list for promoting confirmations to `upcMappings`. Today that's done by hand in the Firestore console.
- Deployment: `lookupBarcode` added to the functions deploy target, `firebase deploy --only firestore:rules`, then the website, following DEPLOYMENT_SETUP.md, only with your approval.

## Deploying or merging this Phase 0 branch

Not needed for Phase 0: everything above runs locally. If it is ever merged:

- The website build is unchanged.
- `lookupBarcode` is **not** in the automatic functions deploy target, so it isn't deployed.
- The new Firestore rules only take effect when deployed by hand.
