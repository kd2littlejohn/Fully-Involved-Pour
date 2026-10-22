# Scan Barcode — Phase 0 proof of concept

Status: **Phase 0, development only.** Nothing here is visible to users. The
production website build is byte-identical to `main`: the PoC page, its
route and the ZXing decoder are compiled out. Nothing has been deployed.
Gemini is not enabled anywhere.

Goal: decide, with measurements, how FIP should identify a bottle from its
barcode before building the production Scan Barcode button on Add Bottle.

## How it works

A barcode identifies a **product line and size, not one exact bottle**.
Barrel-proof batches, single barrels, store picks and annual releases usually
share one UPC. So nothing in FIP assumes one barcode means one bottle.

**The flow on the PoC page**, built to move into Add Bottle unchanged in
Phase 1:

1. **Scan.** The barcode is decoded and validated on the phone.
2. **Free lookup.** FIP's verified catalog and the user's own saved entries are checked (Firestore only, no AI).
3. **Pick your bottle.** Every candidate for that barcode is listed, each labelled **Verified by FIP**, **Saved by you**, or **AXE suggestion · not verified**, plus **In your bar** where it applies.
4. **Not listed?** The user can choose **Ask AXE about this barcode** (Claude + web search), **Scan Front Label with AXE** (label photo + barcode), or **Enter details manually**. AI runs only when the user taps one of the first two.
5. **Check the details.** Every pre-filled value is tagged: *Verified*, *Saved by you*, *AXE suggestion*, *From your label — check it*, or *You*. A label reading that disagrees with a verified value is shown next to it ("Your label shows 94 · Use that"), never applied silently.
6. **Add it.** If the same release is already in My Bar, **Increase quantity** comes first; a Wishlist copy offers **Move to My Bar**. Otherwise **Add to My Bar** or **Add to Wishlist**. Other releases with the same barcode are mentioned but never treated as duplicates. An opt-in checkbox suggests the bottle for FIP's shared catalog.

**What is never assumed.** Batch numbers, barrel numbers, store picks and
variable proofs come only from:
- an **administrator-verified** catalog entry (for example, one specific batch), or
- the user's **own label**, read by AXE or typed, and marked as such.

AXE candidates never carry them, and the server strips them. A
variable-proof release is never pre-filled with a proof.

**Inventory data model: unchanged.** Saving goes through the existing
`addBottle`, `addBottleInstance` and `updateBottle` hooks.
- The scanned barcode goes in the `upc` field `Bottle` already has (left over from an earlier, removed scan flow).
- Batch, barrel and store pick, which have no field, become part of the bottle name ("… — Batch T101", "… — Barrel 77 — Test Club Pick"). That's how collectors name these bottles, and it keeps two picks with one UPC from looking like duplicates.
- Increase Quantity uses the same instance model as Add Bottle: a plain bottle becomes Bottle 1 plus a new sealed bottle, keeping any existing plain quantity.

## Data: FIP's growing catalog

| Where | What | Who can read / write |
|---|---|---|
| `upcMappings/{gtin13}` | `status: "verified"`, `candidates: [...]`: every verified release for that barcode. A candidate can be a whole product line ("proof varies") or one specific batch, barrel or store pick with its own proof. | Signed-in users read. **No client writes.** Administrators only. |
| `users/{uid}/barcodeEntries/{id}` | What this user said a barcode is, one entry per release they saved, with the My Bar bottle it became and an opt-in `submitForReview`. | **Owner only.** Never read by anyone else's lookup. No price field. |
| `upcPending/{gtin13}` | Server-only review queue: how often an unknown barcode was looked up, plus the last unverified **Claude** suggestion, reused for 30 days. | **No client access.** Never holds Gemini output. |

**How the catalog grows.** Users save what they own, privately. Some tick
"Suggest for FIP's shared catalog". An administrator runs
`functions/scripts/barcode-review.js list`, which groups submissions by
barcode with the unmatched-lookup count. They check each against the bottle,
its label or the producer's site, then `promote` it. From then on that
barcode answers every user for free. One user's mistake can never reach
another user without that check.

**Avoiding repeat AI cost:**
- Verified barcodes cost $0 for everyone.
- A barcode a user saved costs that user $0.
- An unknown barcode that someone already asked AXE about is answered from the stored Claude suggestion for 30 days, still labelled *not verified*.

**Licensing.** Only Claude output is ever stored, and only server-side and
time-limited. Grounded Gemini results are never stored (see the Gemini
section). Search-result URLs are shown as sources and not republished. No
paid barcode database is used.

## What's in the code

| Piece | Where |
|---|---|
| On-device decoding (built-in detector or ZXing) and the ZXing UPC-E fix | `web/src/features/barcode/decoder.ts`, `zxingUpcEFix.ts` |
| Barcode validation (client and server share test vectors) | `web/src/features/barcode/gtin.ts`, `functions/barcode/gtin.js` |
| Candidate list, drafts, field provenance | `web/src/features/barcode/options.ts` |
| My Bar matching, Increase Quantity, new-bottle mapping | `web/src/features/barcode/inventory.ts` |
| UI: match list, details form, save actions | `web/src/features/barcode/Barcode*.tsx` |
| `lookupBarcode` and `identifyBottleLabel` callables | `functions/barcode/lookup.js` |
| Prompts and the guard (sources required, no AI batch/barrel, proof rules, label readings kept separate) | `functions/barcode/identify.js` |
| Claude / Gemini providers (barcode, barcode-photo and label modes) | `functions/barcode/providers/` |
| Catalog review and promotion | `functions/barcode/review.js`, `functions/scripts/barcode-review.js` |
| Claude vs Gemini comparison | `functions/scripts/barcode-poc.js`, `functions/barcode/grade.js` |
| Dev PoC page, route `#/dev/barcode`, dev builds only | `web/src/pages/Dev/BarcodePocPage.tsx` |

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

### 4. Full flow against local emulators (Auth, Firestore, Functions)

This was a real browser on the dev PoC page, with a fictional barcode seeded
through `barcode-review.js` with three verified releases: a standard
release, batch T101, and a generic barrel proof.

| Step | Result |
|---|---|
| Scan the seeded barcode | 3 releases listed, all *Verified by FIP*; catalog lookup about 40 ms warm (about 1.3 s on a cold Functions emulator) |
| Pick batch T101 → Add to My Bar | Proof 124.6 and batch T101 prefilled and tagged *Verified*; bottle saved as "… — Batch T101" with `upc`; one private entry saved |
| Scan again → same release | Marked *You saved this before · In your bar*; **Increase quantity** → 2 instances; no new bottle, no duplicate entry |
| Pick the generic barrel proof | Proof left empty with "Varies by batch or barrel — enter it from your label"; added to Wishlist |
| Scan again → Wishlist copy | **Move to My Bar** moved it |
| Unknown barcode | No AI call; "No match in FIP's catalog yet" with Ask AXE / Scan Front Label / Enter manually (about 100 ms) |
| Manual store pick + suggest for review | Saved as "… — Barrel 77 — Test Club Pick"; appears in `barcode-review.js list` with its unmatched-lookup count |
| Scan that barcode again | Answered from *Saved by you*, still no AI |
| Ask AXE with an invalid key | Clean error; manual entry still offered |

The run caught one bug, now fixed: `admin.firestore.FieldValue` is
undefined inside the Functions emulator runtime (it worked under unit tests),
so the unknown-barcode counter threw. It now imports `FieldValue` from
`firebase-admin/firestore`, as the Party Mode service does.

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

`web/.env.development` turns on mock auth by default, so the page saves to
in-memory sample data. Scanning, timing and ground-truth recording work
either way.

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

- Modes: `upc` (decoded barcode), `photo` (barcode photo, digits withheld) and `label` (front-label photo saved from the page as `<gtin13>-label.jpg`, plus the barcode). Record the proof and batch/barrel printed on the label while scanning, so the label test also measures how accurately AXE reads them.
- `claude-sonnet-4-6` is the model FIP's other AI features use today. `claude-opus-5-5` is the current model. Running both shows whether the cheaper one is accurate enough.
- After approval, add `GEMINI_API_KEY=…` (and `--gemini-model`, checked with `--list-gemini-models`) and the same command runs Gemini side by side.
- 30 bottles × 2 modes × 2 Claude models is 120 calls, worst case about $30, expected well under $10. Adding Gemini is 60 more calls; its search queries fall inside its free monthly allowance.

The output `summary.md` shows, for each provider and mode:
- **correct** (the right release is the first candidate) and **in list** (offered, so the user can still pick it)
- partial, wrong and not-found rates, and the average number of candidates
- over-claims: an AI-asserted batch or barrel, a single proof on a batch/barrel/pick, or a missed shared UPC
- label proof and batch reading accuracy
- median and p90 latency, and measured cost per lookup and per 1,000 lookups
`results.csv` has a blank `manual_grade` column for checking anything the
automatic grader marked partial or wrong.

### Step 3: end-to-end flow (optional, emulators, nothing deployed)

```sh
echo "ANTHROPIC_API_KEY=…" > functions/.secret.local      # only needed for AXE
firebase emulators:start --only auth,firestore,functions
# seed a test barcode (fictional data):
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=fully-involved-pour \
  node functions/scripts/barcode-review.js add 0036000291452 '{"name":"Test Bourbon","releaseKind":"standard","proof":90,"sizeMl":750}'
VITE_MOCK_AUTH=false VITE_FIREBASE_EMULATORS=true npm run dev   # in web/
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
- Summaries of the terms say grounded results may be shown only to the user who asked, and may **not be cached or stored**. That conflicts with "cache verified UPC mappings" if the stored facts came from Gemini. The design stores only what each user saves (privately), administrator-verified candidates, and time-limited **Claude** suggestions. It never stores Gemini output. Whether a user-saved entry that started from a grounded Gemini answer can be promoted to the shared catalog needs a read of the Gemini API Additional Terms before production.
- Claude's web search has a per-search price ($10 per 1,000 searches, plus result tokens) and no such display requirement. No comparable storage restriction was found, but its terms should be checked before production, because the 30-day reuse of Claude suggestions depends on it.

## Cost picture (to be replaced by measured numbers)

| Event | Expected cost |
|---|---|
| Decode (ZXing or built-in) | $0 |
| Every scan: verified catalog + your entries | 1 document read + 1 small query, effectively $0 |
| Unknown barcode someone already asked AXE about (within 30 days) | $0 (stored Claude suggestion, labelled not verified) |
| Scan Front Label with AXE (Claude vision + up to 3 web searches) | about $0.05–0.12 per label, to be measured by the `label` mode |
| Unknown barcode, Claude Opus 5.5 + web search | about $0.04–0.10 per lookup (tokens ~$4/$20 per 1M plus $0.01 per search, up to 3 searches) |
| Unknown barcode, Claude Sonnet 4.6 + web search | similar order, measured by the script |
| Unknown barcode, Gemini 3 Flash + grounding | tokens about $0.005–0.02; searches $0 within 5,000/month, then about $0.014 each |

AI never runs automatically. It runs only when the user taps Ask AXE or Scan
Front Label. A barcode costs AI money at most once per 30 days across all
users, then $0 for everyone once an administrator verifies it.

## Decisions this needs from you

1. **Approve Gemini setup for the comparison** (option A above, AI Studio key, budget alert). The 30-bottle Claude run can happen first without it.
2. **Run the 30-bottle test** (steps 1–2). Phone testing has to be done on your devices.
3. Before production: read the storage terms for whichever AI wins (Gemini grounding, and Claude web search for the 30-day reuse).
4. Agree the naming convention for batch, barrel and store pick in My Bar ("… — Batch C924", "… — Barrel 77 — Store Pick"), or approve dedicated optional fields on `Bottle` in Phase 1.

## Phase 1 (production): planned, not started

- A **Scan Barcode** card on Add Bottle's entry screen (next to Scan Label with AI and Manual Entry), and a Scan Barcode button under the bottle name field. It opens the same flow, using `BarcodeMatchList`, `BarcodeBottleForm` and `BarcodeSaveActions` from the PoC.
- Picking a bottle fills the existing Add Bottle form, and the existing save path is used. Increase Quantity and Move to My Bar work as in the PoC.
- If Gemini is chosen: show Google's Search Suggestions element with grounded answers, and never store them.
- Administrator review stays a script until volume justifies an admin screen.
- Deployment, only with approval:
  1. add `lookupBarcode` and `identifyBottleLabel` to the functions deploy target
  2. `firebase deploy --only firestore:rules,firestore:indexes` (the review queue needs the new collection-group index)
  3. the website, following DEPLOYMENT_SETUP.md

## Deploying or merging this Phase 0 branch

Not needed for Phase 0: everything above runs locally. If it is ever merged:

- The website build is unchanged.
- `lookupBarcode` and `identifyBottleLabel` are **not** in the automatic functions deploy target, so they aren't deployed.
- The new Firestore rules and index only take effect when deployed by hand.
