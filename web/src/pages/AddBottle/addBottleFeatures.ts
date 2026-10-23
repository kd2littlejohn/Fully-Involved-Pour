// Switches for optional entry points on Add Bottle.
//
// scanBarcode: Scan Barcode (features/barcode) on the choice screen and
// under the bottle name. Off since 2026-10-23: Scan Label with AXE is the
// primary way to add a bottle, because the label shows what a UPC can't
// (expression, batch, barrel, proof, store pick). The barcode code, its
// Cloud Functions and the UPC catalog are kept for later; nothing runs a
// barcode or Google lookup while this is off.
export const addBottleFeatures = { scanBarcode: false }
