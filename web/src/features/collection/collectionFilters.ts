import type { Bottle, Pour } from '../../data/types'
import {
  isLowFill,
  needsReplacement,
  isRareOrAllocated,
  isNeverReviewed,
  isNotPouredRecently,
  isDuplicateBottle,
  NOT_POURED_RECENTLY_DAYS,
} from './inventoryFilters'

// 'core-bar' is intentionally excluded from matchesFilter below — Core Bar
// is computed from pour history (features/coreBar/selectors.ts) and swapped
// in as the base bottle list by the caller instead of being a per-bottle
// predicate, same as before this batch.
export type Filter =
  | 'all'
  | 'open'
  | 'sealed'
  | 'finished'
  | 'wishlist'
  | 'incoming'
  | 'favorites'
  | 'core-bar'
  | 'low-fill'
  | 'rare-allocated'
  | 'needs-replacement'
  | 'never-reviewed'
  | 'not-poured-recently'
  | 'duplicates'
  | 'infinity-ingredients'

export interface FilterMeta {
  value: Filter
  label: string
  description: string
}

// The handful of views common enough to earn a permanent, always-visible
// spot (the header summary tiles + the quick chip row) — everything else
// lives in the "More Filters" sheet so the page never has to render all 15
// as large permanent buttons (see CollectionFilterSheet).
export const QUICK_FILTERS: FilterMeta[] = [
  { value: 'all', label: 'All', description: 'Every bottle you own.' },
  { value: 'open', label: 'Open', description: 'Bottles currently opened.' },
  { value: 'sealed', label: 'Sealed', description: 'Unopened bottles.' },
  { value: 'finished', label: 'Finished', description: 'Bottles you’ve finished.' },
  { value: 'low-fill', label: 'Low Fill', description: 'Open bottles running low.' },
]

export const MORE_FILTERS: FilterMeta[] = [
  { value: 'favorites', label: 'Favorites', description: 'Bottles you’ve marked as favorites.' },
  { value: 'wishlist', label: 'Wishlist', description: 'Bottles you don’t own yet.' },
  { value: 'incoming', label: 'Incoming', description: 'On the way, not yet in hand.' },
  { value: 'core-bar', label: 'Core Bar', description: 'The bottles you keep coming back to.' },
  { value: 'rare-allocated', label: 'Rare & Allocated', description: 'Allocated, Rare, and Unicorn bottles.' },
  { value: 'needs-replacement', label: 'Needs Replacement', description: 'Bottles you’ve flagged to replace.' },
  { value: 'never-reviewed', label: 'Never Reviewed', description: 'Owned bottles with no rating yet.' },
  { value: 'not-poured-recently', label: 'Not Poured Recently', description: `Open bottles untouched for ${NOT_POURED_RECENTLY_DAYS}+ days.` },
  { value: 'duplicates', label: 'Duplicates', description: 'Bottles you own more than one of.' },
  { value: 'infinity-ingredients', label: 'Infinity Bottle Ingredients', description: 'Poured into an Infinity Bottle blend.' },
]

export const ALL_FILTERS: FilterMeta[] = [...QUICK_FILTERS, ...MORE_FILTERS]

export function filterLabel(value: Filter): string {
  return ALL_FILTERS.find((f) => f.value === value)?.label ?? value
}

// The single per-bottle predicate every My Bar filter (other than Core Bar
// and rarity-chart selection) resolves through — one place to keep the 15
// views from drifting out of sync with each other or with the selectors
// they're each built on.
export function matchesFilter(bottle: Bottle, filter: Filter, pours: Pour[], infinityIngredientIds: Set<string>): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'favorites':
      return Boolean(bottle.favorite)
    case 'core-bar':
      return false // Core Bar is computed from pours, handled separately by the caller.
    case 'low-fill':
      return isLowFill(bottle)
    case 'rare-allocated':
      return isRareOrAllocated(bottle)
    case 'needs-replacement':
      return needsReplacement(bottle)
    case 'never-reviewed':
      return isNeverReviewed(bottle, pours)
    case 'not-poured-recently':
      return isNotPouredRecently(bottle, pours)
    case 'duplicates':
      return isDuplicateBottle(bottle)
    case 'infinity-ingredients':
      return infinityIngredientIds.has(bottle.id)
    default:
      return bottle.status === filter
  }
}
