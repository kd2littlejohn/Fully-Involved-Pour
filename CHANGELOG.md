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
