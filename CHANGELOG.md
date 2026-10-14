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
