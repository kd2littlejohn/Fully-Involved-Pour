## v0.4.2 - More Bottle Info on Add

Added
- MSRP (optional) field to the Add/Edit Bottle form, alongside Price paid.
- Mash bill (optional): Corn %, Rye/Wheat %, and Malted Barley % fields on the Add/Edit Bottle form.
- Bottle size in ml (optional) field on the Add/Edit Bottle form.
- Shelf (optional) and Fill level (optional) fields on the Add/Edit Bottle form.
- Wishlist priority (optional), shown only when status is Wish List — controls ordering on the Discover Wishlist.
- "This is a Legacy Shelf bottle" checkbox with an optional reason, feeding the existing Legacy Shelf scoring/filtering that previously had no way to be set from the app.

Changed
- Label scan and "Ask AI to fill in the rest" now carry MSRP through to the saved bottle instead of discarding it.
- "Ask AI to fill in the rest" also fills in mash bill percentages when they're publicly known, so the Mash Bill shown on Bottle Details/Compare is no longer always blank for AI-assisted adds.
- Fill level now defaults to Full the moment a bottle's status becomes Opened, and to Empty when it becomes Finished — same pattern as the existing Finished-date default — unless already set.

No Firebase schema changes (msrp, mash bill, bottleSize, shelf, fillLevel, priority, legacyShelf, and legacyShelfReason all already existed on Bottle; they just weren't reachable from Add Bottle before). Every field the Bottle Details Overview tab displays, plus every scoring/sorting flag the app already read, is now settable from Add/Edit Bottle.

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
