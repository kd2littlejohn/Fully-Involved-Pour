## Unreleased - Scan Barcode: Google first

Added
- **Google first for unknown barcodes.** When FIP's catalog and your own bottles don't know a barcode, Scan Barcode searches Google (Gemini with Google Search grounding) automatically and lists its suggestions as *Google suggestion · not verified*, with Google's source links and Search Suggestions. If Google can't identify it, the app offers *Ask AXE*, *Scan Front Label with AXE* or manual entry. The same barcode isn't sent to Google twice in one session.
- **Controls:** server-side key only, sign-in required, 30 Google lookups per user per hour, a monthly spending limit, an off switch and optional App Check, all in `appConfig/barcodeGoogle` (no redeploy). Google is **off** until the owner turns it on.
- **Catalog review:** `barcode-review.js unmatched` lists the most-scanned barcodes FIP doesn't know yet, so administrators verify those first and Google is needed less over time.

Fixed
- **Black camera preview on iPhone.** The scanner now sets Safari's inline-playback attributes before attaching the camera, waits for a real picture, retries with simpler camera settings if the preview stays black, offers *Tap to start the camera* when the phone blocks auto-play, and always releases a camera it no longer needs.

Data: nothing Google returns is stored. A bottle picked from a Google suggestion is saved to My Bar or your Wishlist as usual, but isn't remembered as a barcode entry and can't be suggested for the shared catalog. New server-only documents: `appConfig/barcodeGoogle` and `aiSpend/gemini-YYYY-MM`.

Release notes: the `GEMINI_API_KEY` secret must exist before this deploys (the workflow checks). See docs/BARCODE_POC.md → "Turning on Google".

## Unreleased - Scan Barcode

Added
- **Scan Barcode on Add Bottle.** It's the first option when adding a bottle, and a button under the name field of a new bottle. The barcode (UPC-A, UPC-E or EAN-13) is read on the phone with the camera, a photo, or typed digits.
- **One barcode, several bottles.** FIP's verified catalog and your own saved bottles are checked first, at no AI cost. Every matching release (standard, barrel-proof batches, single barrels, store picks) is listed and labelled *Verified by FIP*, *Saved by you* or *AXE suggestion · not verified*, so you pick yours.
- **AXE only when you ask.** *Ask AXE about this barcode* and *Scan Front Label with AXE* (label photo plus barcode) suggest releases with their sources. Batch, barrel and variable proof never come from AI; what AXE reads on your own label is marked "From your label — check it".
- **No duplicates.** If the release is already in My Bar, *Increase quantity* adds another sealed bottle through the existing instance model; a Wishlist copy offers *Move to My Bar*. Otherwise *Add to My Bar* or *Add to Wishlist* fills the regular Add Bottle form, so photo, price, quantity and rarity work as before.
- **Your bottles are remembered privately.** The next scan of that barcode answers instantly. Opt-in suggestions to FIP's shared catalog stay private until an administrator verifies them (`functions/scripts/barcode-review.js`).

Changed
- When a scanned release's proof varies, "Ask AI to fill in the rest" no longer fills in a proof.

Data: the barcode is stored in the existing `upc` field on a bottle, and batch, barrel and store pick become part of the bottle name. New collections: `upcMappings` (verified catalog, read-only to clients), `users/{uid}/barcodeEntries` (private), and `upcPending` (server-only review queue). No migration is needed.

Release notes: the release workflow now always deploys `lookupBarcode` and `identifyBottleLabel` with the functions, and checks they're live. After the website, publish Firestore rules and indexes (`firebase deploy --only firestore:rules,firestore:indexes`). Until then, everything works except remembering scanned barcodes. AI-answer reuse is off and Gemini is not enabled.

## Unreleased - Tasting experience and host participation

Added
- Home: two entries under Quick Actions. **Log a Tasting** goes straight to picking a bottle from My Bar and opens the existing Pour Story tasting. **Blind Tastings** opens the Blind Room. No new nav tab, and the hero and AXE Insight are unchanged.
- Blind Room: four clear options (Start Solo Blind Tasting, Taste with Friends, Host a Tasting Party, Join a Tasting Party), with **Resume Tasting** above them for the most recent blind or party in progress.
- Party Mode **regular tastings**: everyone sees the bottles while they score, and closing voting shows results with no reveal step. Blind stays the default, and existing parties are unchanged.
- **I'm tasting too** (on by default): the host scores alongside guests from the same account. The host's ballot counts exactly like a guest's: one per round, same scale and deadlines, equal weight. It can be turned off or on later; off stops the host's ballots counting in rounds not yet revealed, and on restores them.
- Host dashboard **Manage Party / My Tasting** switch: one tap, always at the top, with personal progress ("2 of 3 samples scored"). Unsaved scores, the chosen round and the last sample are kept when switching or leaving the page. My Tasting has no admin controls and stays blind until the reveal.

- **Protected bottle key:** the bottle mapping is no longer readable by any client. The host or a co-host opens it from the dashboard behind a confirmation. Every view before a reveal is logged and listed on the dashboard. Editing setup no longer shows bottles until the key is opened.
- **Co-host / pour assistant:** a one-time invite link lets another FIP account set up bottles, pour, hold the key and run rounds, so the host can taste truly blind. Co-hosts don't score and can't delete the party.
- **Blind integrity:** if the tasting host set up a round's bottles, or opened the key before finishing that round, their ballot is marked "not fully blind". It still counts equally, and results say so.
- **Save to My Tastings:** after a blind round is revealed, or a regular round's results are out, tasters can save their scores, notes and flavors to My Tastings in the Journal. Re-saving never duplicates, nothing is added to My Bar, and saved tastings count toward Your Palate.

Changed
- Hosts can no longer join their own party as a guest, or enter a paper ballot under their own name while tasting. Both would double count; use My Tasting instead.

Release notes: deploy the `partyAction` function, then the website, then Firestore rules (`firebase deploy --only firestore:rules`). No indexes or data migrations are needed; existing parties and user data are unchanged.

## Unreleased - Legacy Bottle editing

Added
- The Legacy Bottle card's ••• menu now works: Edit Legacy Story, Change Legacy Bottle, View Bottle Details, Add another Legacy Bottle, and Remove Legacy Status.
- Legacy Story editor, prefilled from what's saved: story title, "why it matters", the full personal story, an occasion or person, and a meaningful date. It's kept separate from tasting notes and flavors: the story is about what the bottle means, not how it tastes.
- Open Story now shows the complete story, with an Edit button and a link on to the bottle's pours and memories.
- Change Legacy Bottle lets you search the bottles already in My Bar. Legacy status moves in one save, and the previous bottle keeps its story, inventory and history.
- Removing Legacy status asks first and only clears the Legacy flag. The bottle, its story and its tasting history all stay.
- Saving, success and error states on every action.

Changed
- The overflow (•••) menu closes when you tap outside it on iPhone, opens upward when it would run under the bottom nav, and is no longer clipped by the Legacy Bottle card.

Data: the new story fields (`legacyStoryTitle`, `legacyStory`, `legacyOccasion`, `legacyDate`, `legacyStoryUpdatedAt`) sit on the existing bottle record in `users/{uid}`, beside `legacyShelf` and `legacyShelfReason`. No Firestore rules or index changes are needed, and the fields aren't included in the shared-collection projection friends can see.

## Unreleased - Blind Room Party Mode

Added
- Blind Room Party Mode: a hosted blind tasting for a whole room, alongside the existing Solo and Friends blinds (unchanged). The Party hub (Blind Room → Party Mode) has Create, Join, Resume and Past Parties.
- Tasting Category Library: 20 predefined categories plus the host's own saved custom categories. Search, tag filters, rename, reorder, duplicate a round, remove before voting, and saved setups. Up to 24 rounds per party, and 2–12 bottles per round (head-to-head included).
- Guided Create a Party flow: details and optional cover, categories, bottles from My Bar or entered manually (snapshots only, so inventory and history are never touched), blind letters shuffled or picked by hand, and scoring/reveal settings.
- Guests join by QR code, link or code with just a nickname. No account, email or app install. Each guest gets a recovery code for switching devices.
- Quick Score (one 0–10 enjoyment rating) and Detailed Score (nose, palate, finish, complexity, notes) on one shared draft. Rankings use overall enjoyment only, so both methods count equally.
- Host-entered paper ballots that count the same as digital ones. Duplicate detection, exclude/restore, edit and delete with confirmation, and an audit log. Printable scorecards sized to each round's actual bottles.
- Live host dashboard: invite/QR (full screen), close or expire joins, rotate the code, guest list with removal, ballot counts, and Draft → Ready → Voting Open → Voting Closed → Revealed controls. Nothing reveals automatically.
- Results: podium with shared ties, averages that skip missing scores and show their rating counts, People's Choice from explicit favorites, data-backed awards (Category Champion, People's Choice, Best Value when every rated bottle has a price, Biggest Surprise from real predictions), and per-taster comparisons.
- Party Recap built from revealed rounds only, shareable as an image or PDF. TV/Party Display mode as a read-only, token-scoped session with a host-driven reveal.
- AXE after a reveal (optional): preset questions answered from the round's published results and the guest's own ballot only.
- Optional "keep my results" for guests: links their guest identity to a new FIP account, or claims their records into an existing one.

Changed
- Anonymous Firebase identities (party guests) are treated as signed out everywhere else in the app.
- `firebase.json` now configures the auth and functions emulators, and the web app can target local emulators with `VITE_FIREBASE_EMULATORS=true` (dev only).

Release notes: see docs/PARTY_MODE.md. Enable **Anonymous** sign-in in Firebase Authentication, deploy Firestore rules, indexes and Storage rules, then deploy the `partyAction` and `askSommelier` functions before the website. Existing collections and stored data are unchanged.

## v0.5.0 - AXE, Your Personal Sommelier

Added
- AXE — Your Personal Sommelier ("Guiding Your Whiskey Journey."), replacing the old, unreachable Sommelier panel. It opens as a bottom sheet on mobile and a side drawer on desktop, from a subtle "Ask AXE" button that uses the existing Glencairn compass logo, unchanged.
- Contextual integration: AXE knows the screen you're on (Home, My Bar, Bottle Details, Journey/Bottle Stories, Discover, Profile → Your Palate, Friends, Blind Room, Infinity Bottle), with tailored intros and suggested questions. Bottle Details passes the selected bottle automatically.
- In-workflow AXE help: "What Should I Pour?" explains the current pick without re-rolling it. The Pour Story wizard's tasting steps, Infinity Bottle Log a Tasting, and Add to Blend send a read-only snapshot of unsaved selections. AXE never changes a form, a tasting, or a blend.
- Conversations survive closing/reopening AXE and navigating, and are cleared on sign-out or account switch.

Changed
- User-facing "sommelier" text now says AXE. Internal names, routes, the `askSommelier` callable, and stored data are unchanged.
- `askSommelier` builds AXE's context server-side from the signed-in user's own `users/{uid}` document. Client-supplied uids and collection summaries are ignored.
- Stored text is length-capped and treated as data, not instructions. Blind Room lineups stay hidden until the reveal, even for the host. The function now uses the existing per-user rate limiter (60/hour).
- AXE uses the same validated palate insights as Profile → Your Palate (`palateInsights.ts`). Experienced and preferred flavors stay separate, and with too little data AXE says so instead of inventing a preference.

Fixed
- Your Palate, the Home palate card, and Palate Breakdown no longer crash on pours saved by the legacy app's guided tasting, which have a rating but no `fip` breakdown. Those pours still count toward pour count and average score, but add no component scores or flavor tags. This is read-side only: no stored pour is rewritten.
- Infinity Bottle tasting dates (history, detail modal, score chart) no longer show one day early for viewers west of UTC.

Release note: deploy Cloud Functions before the website. The new web client relies on the updated `askSommelier`. Older clients keep working with the new function.

No Firebase schema, security rules, or index changes.

## v0.4.3 - Palate Tracker Accuracy

Fixed
- Your Palate / Profile's flavor measures (Flavor Radar, "experienced" chips, Palate Breakdown, Whiskey Identity) no longer count a sealed/wishlist/incoming bottle's own notes or legacy `flavors` field — including notes written via Add/Edit Bottle's "AI Tasting Note" before the bottle was ever opened — as tasting history. Only bottles with at least one actual pour contribute.
- "Flavors you tend to prefer" is now a separate, rating-aware measurement from "Flavors you've experienced most" (frequency-only, same as before). Preferred flavors only ever come from pours rated 8.0+ (Working Fire and above) across at least 2 *different* bottles, so repeated tastings of one favorite bottle can no longer look like an established, palate-wide preference. Below that bar, an honest "not enough data yet" note shows instead of nothing/guessed data.

Changed
- Relabeled "You seem to gravitate toward" to "Flavors you've experienced most" to match what that chip list actually measures (frequency, not preference).

No Firebase schema changes — this is a calculation/display fix only, reading the same stored Bottle/Pour fields as before.

## v0.4.1 - Journey Layout

Changed
- Reworked the Journey page to match the approved desktop mockup layout.
- Added dynamic Continue Your Journey, Timeline Preview, People, and Bottles in Your Story previews using existing app data.
- Tightened the Journey hero, tabs, sidebar, section grid, and bottom call-to-action proportions.

Fixed
- Journey desktop section placement and sidebar alignment.
- People preview remains derived from tagged Pour Story companions.

No Firebase schema changes.

## v0.4.0 - Pour Stories

Added
- Bottle timeline
- Journey stages
- Story cards
- Filters

Changed
- Bottle Details now links to Pour Stories

Fixed
- Mobile spacing
- Timeline alignment

No Firebase schema changes.
