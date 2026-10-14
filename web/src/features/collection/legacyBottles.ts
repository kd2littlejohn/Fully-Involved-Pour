import type { Bottle } from '../../data/types'

// Legacy Bottles are the user's personally meaningful bottles — the
// existing legacyShelf / legacyShelfReason fields (set in the original app
// and still read by What Should I Pour), never a rarity tier. Any status
// counts, finished included: a bottle keeps its Legacy status for good.
// Order: ones with a story first, then the longest-held.
export function legacyBottles(bottles: Bottle[]): Bottle[] {
  return bottles
    .filter((bottle) => bottle.legacyShelf && bottle.status !== 'wishlist')
    .sort((a, b) => {
      const story = Number(Boolean(b.legacyShelfReason?.trim())) - Number(Boolean(a.legacyShelfReason?.trim()))
      if (story !== 0) return story
      return (a.createdAt ?? 0) - (b.createdAt ?? 0)
    })
}

// Bottles that could become a Legacy Bottle: anything the user actually
// has or had (not wishlist), not already Legacy.
export function legacyCandidates(bottles: Bottle[]): Bottle[] {
  return bottles.filter((bottle) => !bottle.legacyShelf && bottle.status !== 'wishlist').sort((a, b) => a.name.localeCompare(b.name))
}
