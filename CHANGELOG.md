## v0.4.2 - MSRP on Add Bottle

Added
- MSRP (optional) field to the Add/Edit Bottle form, alongside Price paid.

Changed
- Label scan and "Ask AI to fill in the rest" now carry MSRP through to the saved bottle instead of discarding it.

No Firebase schema changes (the `msrp` field already existed on Bottle; it just wasn't reachable from Add Bottle before).

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
