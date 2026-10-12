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
