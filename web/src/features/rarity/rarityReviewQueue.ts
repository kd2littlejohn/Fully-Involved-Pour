import type { Bottle } from '../../data/types'
import { isOwnedForRarity, isRarityConfirmed } from './rarityFields'
import { rarityIdentity, rarityIdentityKey } from '../../data/repositories/rarity'

// Owned (excludes Wishlist/Incoming), not yet confirmed — this includes a
// bottle with no rarity data at all AND one that already has a pending
// suggestion still awaiting review. Sorted by name for a stable render
// order across re-fetches.
export function selectRarityReviewQueue(bottles: Bottle[]): Bottle[] {
  return bottles.filter((b) => isOwnedForRarity(b) && !isRarityConfirmed(b)).sort((a, b) => a.name.localeCompare(b.name))
}

// True when the bottle either has no suggestion yet, or its suggestion was
// generated for a bottle identity that no longer matches the bottle's
// current fields (name/distillery/etc. edited since).
export function needsFetch(bottle: Bottle): boolean {
  if (!bottle.raritySuggestion) return true
  return bottle.raritySuggestion.identityKey !== rarityIdentityKey(rarityIdentity(bottle))
}

// Only bottles with a fresh, high-confidence, non-null pending suggestion
// are eligible for "Accept All High-Confidence Suggestions" — Medium/Low
// always require individual review.
export function highConfidenceAcceptableIds(bottles: Bottle[]): string[] {
  return bottles
    .filter((b) => b.raritySuggestion && !needsFetch(b) && b.raritySuggestion.confidence === 'high' && b.raritySuggestion.rarity !== null)
    .map((b) => b.id)
}
