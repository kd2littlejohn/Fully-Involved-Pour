import type { Bottle, BottleRarity } from '../../data/types'
import { confirmedRarityOf, isRarityConfirmed } from './rarityFields'

export type RarityFilterValue = BottleRarity | 'unclassified' | null

// Applied as one more stage in CollectionPage's existing filter pipeline
// (status filter, then search, then this) — composes as an AND with
// whatever those already narrowed the list to, regardless of the bottle's
// status (a wishlist/incoming bottle that happens to carry a manually-set
// rarity can still match a rarity filter, even though it's excluded from
// the chart's own totals).
export function matchesRarityFilter(bottle: Bottle, value: RarityFilterValue): boolean {
  if (value === null) return true
  if (value === 'unclassified') return !isRarityConfirmed(bottle)
  return confirmedRarityOf(bottle) === value
}
