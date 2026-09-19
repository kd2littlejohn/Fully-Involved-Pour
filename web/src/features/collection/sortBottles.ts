import type { Bottle, Pour } from '../../data/types'
import { RARITY_OPTIONS } from '../rarity/rarityLevels'
import { confirmedRarityOf } from '../rarity/rarityFields'
import { fillLevelPercent, getPoursForBottle } from '../bottleDetails/selectors'

export type SortOption =
  | 'recent'
  | 'name-asc'
  | 'name-desc'
  | 'rating-desc'
  | 'proof-desc'
  | 'poured-desc'
  | 'fill-desc'
  | 'rarity-desc'
  | 'price-desc'
  | 'quantity-desc'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'poured-desc', label: 'Recently Poured' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'rating-desc', label: 'Highest Rated' },
  { value: 'proof-desc', label: 'Proof (High to Low)' },
  { value: 'fill-desc', label: 'Fill Level' },
  { value: 'rarity-desc', label: 'Rarity' },
  { value: 'price-desc', label: 'Purchase Price' },
  { value: 'quantity-desc', label: 'Quantity' },
]

// Common -> Unicorn ordinal, matching RARITY_OPTIONS' own display order —
// a bottle with no confirmed rarity sorts as if it had none (sinks below
// Common, same "unset sinks to the bottom" rule every other sort here uses).
const RARITY_RANK: Record<string, number> = Object.fromEntries(RARITY_OPTIONS.map((o, i) => [o.value, i]))

function lastPouredAt(bottle: Bottle, pours: Pour[]): number {
  const latest = getPoursForBottle(pours, bottle.id)[0]
  return latest ? new Date(latest.date).getTime() : -Infinity
}

// Bottles without the sorted-on field (no rating/proof/createdAt/price/fill
// level/rarity/pours yet) sink to the bottom rather than being treated as
// 0 — a bottle with an unset rating isn't "rated zero," it's just unrated.
export function sortBottles(bottles: Bottle[], sort: SortOption, pours: Pour[] = []): Bottle[] {
  const sorted = [...bottles]
  switch (sort) {
    case 'name-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'name-desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name))
    case 'rating-desc':
      return sorted.sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity))
    case 'proof-desc':
      return sorted.sort((a, b) => (b.proof ?? -Infinity) - (a.proof ?? -Infinity))
    case 'poured-desc':
      return sorted.sort((a, b) => lastPouredAt(b, pours) - lastPouredAt(a, pours))
    case 'fill-desc':
      return sorted.sort((a, b) => (fillLevelPercent(b) ?? -Infinity) - (fillLevelPercent(a) ?? -Infinity))
    case 'rarity-desc':
      return sorted.sort((a, b) => {
        const ra = confirmedRarityOf(a)
        const rb = confirmedRarityOf(b)
        return (rb ? (RARITY_RANK[rb] ?? -1) : -Infinity) - (ra ? (RARITY_RANK[ra] ?? -1) : -Infinity)
      })
    case 'price-desc':
      return sorted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))
    case 'quantity-desc':
      return sorted.sort((a, b) => (b.quantity ?? 1) - (a.quantity ?? 1))
    case 'recent':
    default:
      return sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }
}
