# Scan Barcode

Status: **released on Add Bottle** (Phase 1). Add Bottle opens with a
**Scan Barcode** option, and new bottles have a Scan Barcode button under
the name field. AXE (Claude) identification runs only when the user asks.
AI-answer reuse is off, and Gemini is not enabled.

The Phase 0 investigation (decoder benchmarks, emulator runs, the terms
review) is kept below. The field test on phones was skipped by decision on
2026-10-22, so real-world accuracy, response time and cost are still to be
measured from production use.

## Release checklist

1. **Merge to `main`.** `deploy.yml` runs automatically.
2. **Approve *production-functions*.** This deploys `lookupBarcode` and `identifyBottleLabel` (now always part of the release, like askSommelier). A post-deploy step checks both answer 401 to unauthenticated calls.
3. **Approve *production-website*.** This publishes the site with Scan Barcode.
4. **Publish Firestore rules and indexes by hand**, as every release does: `firebase deploy --only firestore:rules,firestore:indexes`, or paste `firestore.rules` into Firebase console → Firestore → Rules → Publish. Until then everything works except "remember this barcode": that private entry write is refused and silently skipped, so the next scan of that barcode isn't instant yet. The index only serves the administrator review script.

## How it works

A barcode identifies a **product line and size, not one exact bottle**.
Barrel-proof batches, single barrels, store picks and annual releases usually
share one UPC. So nothing in FIP assumes one barcode means one bottle.

**The flow** (`features/barcode/ScanBarcodeFlow.tsx`, opened from Add
Bottle):

1. **Scan.** The barcode is decoded and validated on the phone.
2. **Free lookup.** FIP's verified catalog and the user's own saved entries are checked (Firestore only, no AI).
3. **Pick your bottle.** Every candidate for that barcode is listed, each labelled **Verified by FIP**, **Saved by you**, or **AXE suggestion · not verified**, plus **In your bar** where it applies.
4. **Not listed?** The user can choose **Ask AXE about this barcode** (Claude + web search), **Scan Front Label with AXE** (label photo + barcode), or **Enter details manually**. AI runs only when the user taps one of the first two.
5. **Check the details.** Every pre-filled value is tagged: *Verified*, *Saved by you*, *AXE suggestion*, *From your label — check it*, or *You*. A label reading that disagrees with a verified value is shown next to it ("Your label shows 94 · Use that"), never applied silently.
6. **Add it.** If the same release is already in My Bar, **Increase quantity** comes first; a Wishlist copy offers **Move to My Bar**. Both save straight away. Otherwise **Add to My Bar** or **Add to Wishlist** fills the regular Add Bottle form (name, distillery, type, proof, size, age and status), where photo, price, quantity and rarity can be added; **Add Bottle** saves it with the barcode in `upc`. Other releases with the same barcode are mentioned but never treated as duplicates. An opt-in checkbox suggests the bottle for FIP's shared catalog.

When the barcode says a release's proof varies, the form's "Ask AI to fill in the rest" never supplies a proof: only the label can.

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
| `upcPending/{gtin13}` | Server-only review queue: how often an unknown barcode was looked up. Can also hold the last unverified **Claude** suggestion for 30-day reuse, but that is **off** (`REUSE_AI_SUGGESTIONS = false`) until the terms review below is signed off. | **No client access.** Never holds Gemini output. |

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
- Built in but **off for now**: reusing a stored Claude suggestion for an unknown barcode for 30 days. Turning it on is a one-line change once the terms are signed off. It also stays off during the field test so latency and cost aren't understated.

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
| Scan Barcode flow on Add Bottle | `web/src/features/barcode/ScanBarcodeFlow.tsx`, `web/src/pages/AddBottle/AddBottlePage.tsx` |
| UI: match list, details form, save actions | `web/src/features/barcode/Barcode*.tsx` |
| `lookupBarcode` and `identifyBottleLabel` callables | `functions/barcode/lookup.js` |
| Prompts and the guard (sources required, no AI batch/barrel, proof rules, label readings kept separate) | `functions/barcode/identify.js` |
| Claude / Gemini providers (barcode, barcode-photo and label modes) | `functions/barcode/providers/` |
| Catalog review and promotion | `functions/barcode/review.js`, `functions/scripts/barcode-review.js` |
| Claude vs Gemini comparison | `functions/scripts/barcode-poc.js`, `functions/barcode/grade.js` |
| Dev diagnostics page, route `#/dev/barcode`, dev builds only | `web/src/pages/Dev/BarcodePocPage.tsx` |
| Field-test recording and CSV, and the offline summary | `web/src/features/barcode/pocResults.ts`, `functions/barcode/pocSummary.js`, `functions/scripts/barcode-poc-summary.js` |

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

## AXE without exposing keys

`lookupBarcode` and `identifyBottleLabel` are Cloud Functions that read
`ANTHROPIC_API_KEY` from Google Secret Manager (`defineSecret`), exactly like
AXE and Scan Label with AI. The app only sends a Firebase sign-in token. The
key never reaches the browser, GitHub or logs. Both are open to any
signed-in user and rate-limited to 20 calls per hour per user per path.

## Anthropic terms review (30-day reuse of AI answers)

Reviewed 2026-10-22:
- [Commercial Terms](https://www.anthropic.com/legal/commercial-terms): the customer **owns Outputs**, and there's no clause restricting storing, caching or redistributing them.
- [Service Specific Terms](https://www.anthropic.com/legal/service-specific-terms): nothing about web search.
- [Web search tool documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool): *"When displaying API outputs directly to end users, citations must be included to the original source. If you are making modifications to API outputs, including by reprocessing or combining them with your own material before displaying them to end users, display citations as appropriate based on consultation with your legal team."*

**Conclusion:** I found no Anthropic term against storing and reusing these
suggestions, provided they're always shown with their sources. FIP reshapes
the output into candidates, which is the "reprocessing" case where the docs
say to consult legal. So:
- Reuse is **disabled** until you or your counsel sign off.
- Every AXE suggestion now carries its own source links in the candidate list (and in a stored suggestion, if reuse is turned on).
- Only extracted facts and source URLs are kept, never page content.

This is a reading of the published terms, not legal advice.

## Other ways to test

### Scanning on a laptop dev server

The camera needs HTTPS, so the dev server needs a certificate:

```sh
cd web
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=fip-dev" \
  -keyout ~/fip-dev-key.pem -out ~/fip-dev-cert.pem
FIP_DEV_HTTPS_CERT=~/fip-dev-cert.pem FIP_DEV_HTTPS_KEY=~/fip-dev-key.pem npm run dev
```

On a phone on the same Wi-Fi, open `https://<laptop-ip>:5173/#/dev/barcode`
and accept the certificate warning. `web/.env.development` turns on mock
auth, so saves go to in-memory sample data.

### Claude vs Gemini comparison script (costs money, needs keys)

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

### End-to-end flow on emulators (nothing deployed)

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
| Unknown barcode someone already asked AXE about (within 30 days) | $0 once reuse is switched on; full price while it's off (today) |
| Scan Front Label with AXE (Claude vision + up to 3 web searches) | about $0.05–0.12 per label, to be measured by the `label` mode |
| Unknown barcode, Claude Opus 5.5 + web search | about $0.04–0.10 per lookup (tokens ~$4/$20 per 1M plus $0.01 per search, up to 3 searches) |
| Unknown barcode, Claude Sonnet 4.6 + web search | similar order, measured by the script |
| Unknown barcode, Gemini 3 Flash + grounding | tokens about $0.005–0.02; searches $0 within 5,000/month, then about $0.014 each |

AI never runs automatically. It runs only when the user taps Ask AXE or Scan
Front Label. Once reuse is switched on, a barcode costs AI money at most once
per 30 days across all users, and $0 for everyone once an administrator
verifies it.

## Remaining limitations

- **Not field-tested on real phones.** Decoding was benchmarked in Chromium (fake camera and synthetic images) and the flow was run end to end on emulators. iPhone Safari camera behaviour, real-world catalog hit rate, AXE accuracy, latency and cost are unmeasured until people use it.
- **The verified catalog starts empty.** Every barcode starts as "no match" until administrators promote submissions (`functions/scripts/barcode-review.js`) or users' own saved entries answer their own repeat scans.
- **The AXE live path is untested.** It has never been exercised against the real Anthropic API from production (tests stub it). The first real calls will show whether the model and web-search settings in `functions/barcode/providers/claude.js` are accepted. Failures show "AXE can't look this barcode up right now" and manual entry still works.
- **Batch, barrel and store pick** are kept in the bottle name until the release-field proposal below is approved.
- **AI-answer reuse is off**, so repeat unknown scans pay again, pending the terms sign-off.
- **Gemini is not enabled.**

## Proposal: release fields on `Bottle` (for approval, not built)

Today's PoC folds batch, barrel and store pick into the bottle name. That
works with every screen as-is, but it isn't structured. The proposal is new
**optional** fields on `Bottle`. Absent means exactly today's behaviour, so
existing bottles need no migration.

| Field | Type | Meaning |
|---|---|---|
| `releaseKind` | `'standard' \| 'barrel-proof-batch' \| 'single-barrel' \| 'store-pick' \| 'limited-release'` | What kind of release this is |
| `batch` | string | Batch as printed, e.g. "C924", "2024-03" |
| `barrelNumber` | string | Barrel or cask number as printed |
| `storePick` | string | Who picked it, e.g. "Total Wine", "Bourbon Club of Ohio" |
| `proofSource` | `'catalog' \| 'label' \| 'user'` | Where `proof` came from |
| `upc` | string | **Already exists**; the scanner fills it |

**Release-specific proof:** keep the existing `proof` field rather than
adding a second one. `proof` already means "this bottle's proof" in about 30
places (palate scoring, What Should I Pour, AXE Insights, rarity, the FIP
Guide, Party Mode, friends' views). For a barrel-proof batch or single
barrel, that *is* the release-specific proof. A separate field would leave
all of those reading the wrong number. `proofSource` records whether it was
verified, read from the label, or typed.

**Level:** these fields belong on the `Bottle`, not on individual physical
bottles (instances). Two batches of the same expression are separate
releases with separate tastings and ratings, so the scanner already creates
a separate bottle for each.

**Compatibility, area by area:**
- **Name:** keep writing the readable suffix too ("… — Batch C924"). Every existing screen then shows the release with no change, and `splitBottleTitle` already turns that suffix into a subtitle. The fields are the structured source the scanner and new code read.
- **Inventory and quantity:** no change. Fields sit beside `instances`.
- **Tastings and pours:** no change. They reference `bottleId`.
- **Rarity:** `detectPickFlags` guesses single barrel / store pick from the name. Prefer `releaseKind` when it's set, falling back to the name. The rarity cache key is unchanged for existing bottles.
- **Search:** My Bar's `matchesQuery` also matches `batch`, `barrelNumber` and `storePick` (so "C924" or "Total Wine" finds the bottle), and the "store pick" / "single barrel" words use `releaseKind` first.
- **FIP Guide:** keyed by name + distillery. Strip the release suffix for the key, so every batch shares one guide instead of paying for one per batch.
- **Sharing with friends:** `sharedCollections` projects an explicit field list. The new fields stay private unless added deliberately.
- **Firestore rules:** the `users/{uid}` document is owner-only with no per-field rules, so no rules change is needed.
- **Add / Edit Bottle:** an optional, collapsed "Release details" section; nothing new is required.
