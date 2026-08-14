import type { Bottle } from '../../data/types'

export type SortOption = 'recent' | 'name-asc' | 'name-desc' | 'rating-desc' | 'proof-desc'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'rating-desc', label: 'Highest Rated' },
  { value: 'proof-desc', label: 'Proof (High to Low)' },
]

// Bottles without the sorted-on field (no rating/proof/createdAt yet) sink to
// the bottom rather than being treated as 0 — a bottle with an unset rating
// isn't "rated zero," it's just unrated.
export function sortBottles(bottles: Bottle[], sort: SortOption): Bottle[] {
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
    case 'recent':
    default:
      return sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }
}
