import type { Bottle } from '../../data/types'

// The photo every bottle surface should display. A standardized
// `imageUrl` has the FIP dark-oak backdrop and 4:5 canvas painted into its
// pixels (see standardizeBottlePhoto.ts), so no amount of CSS can remove
// that frame — the untouched `originalImageUrl` is the only version with
// the photo's own natural shape. Photos saved before standardization
// existed have no original, and their `imageUrl` already IS the plain
// upload, so falling back to it gives every photo — old or new — the same
// natural-aspect result with no re-upload or rewrite of stored data.
export function bottlePhotoUrl(bottle: Pick<Bottle, 'imageUrl' | 'originalImageUrl'>): string | undefined {
  return bottle.originalImageUrl || bottle.imageUrl || undefined
}
