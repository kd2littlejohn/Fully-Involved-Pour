import type { Bottle, InfinityBottle, Pour } from '../../data/types'
import { getCurrentScore, getPoursForBottle } from '../bottleDetails/selectors'
import { confirmedRarityOf } from '../rarity/rarityFields'

// A bottle only meaningfully has a fill level once it's actually open —
// sealed/wishlist/incoming bottles are never "running low."
export function isLowFill(bottle: Pick<Bottle, 'status' | 'fillLevel'>): boolean {
  return bottle.status === 'open' && (bottle.fillLevel === 'quarter' || bottle.fillLevel === 'empty')
}

// Reuses the existing "Your Take" field (see features/bottleDetails/
// YourTakeCard.tsx) rather than a second, parallel flag — "Needs
// Replacement" IS the existing wouldReplace:'yes' choice, just surfaced as
// an inventory filter. The bottle quick actions can set this same field
// via "Add to Replacement List," satisfying the batch's explicit "an
// existing user choice or an explicit user action" either way with one
// field.
export function needsReplacement(bottle: Pick<Bottle, 'wouldReplace'>): boolean {
  return bottle.wouldReplace === 'yes'
}

// The scarce half of the rarity scale — combined into one quick filter.
export function isRareOrUnicorn(bottle: Pick<Bottle, 'rarity' | 'raritySource'>): boolean {
  const rarity = confirmedRarityOf(bottle)
  return rarity === 'rare' || rarity === 'unicorn'
}

// "Reviewed" here means tasted-and-rated (getCurrentScore), not rarity-
// reviewed (that's the separate, already-existing Rarity Review queue) —
// wishlist/incoming bottles are excluded since they can't be reviewed yet.
export function isNeverReviewed(bottle: Bottle, pours: Pour[]): boolean {
  if (bottle.status === 'wishlist' || bottle.status === 'incoming') return false
  return getCurrentScore(bottle, pours) === undefined
}

// Same staleness threshold Home's "Maybe Tonight" card already uses (see
// features/home/selectors.ts) — kept consistent across the app rather than
// inventing a second number. Only open bottles qualify: a sealed bottle
// hasn't been "poured recently" by definition, and that's just what Sealed
// already means.
export const NOT_POURED_RECENTLY_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export function isNotPouredRecently(bottle: Bottle, pours: Pour[], thresholdDays = NOT_POURED_RECENTLY_DAYS): boolean {
  if (bottle.status !== 'open') return false
  const [latest] = getPoursForBottle(pours, bottle.id)
  if (!latest) return true
  const days = (Date.now() - new Date(latest.date).getTime()) / DAY_MS
  return days >= thresholdDays
}

// "Duplicates" = more than one physical copy of this exact bottle entry
// (quantity/instances — see features/bottleInstances/selectors.ts), not two
// separate Bottle records that happen to look alike. `quantity` is always
// kept in sync with `instances.length` once instances exist, so this one
// check covers both representations.
export function isDuplicateBottle(bottle: Pick<Bottle, 'quantity' | 'instances'>): boolean {
  return (bottle.instances?.length ?? bottle.quantity ?? 1) > 1
}

// Every bottle that has ever been poured into an Infinity Bottle blend, own
// vessel or archived alike — a real usage fact from BlendAddition.sourceBottleId,
// never guessed.
export function getInfinityIngredientBottleIds(infinityBottles: InfinityBottle[]): Set<string> {
  const ids = new Set<string>()
  for (const ib of infinityBottles) {
    for (const batch of ib.batches ?? []) {
      for (const addition of batch.additions ?? []) {
        if (addition.sourceBottleId) ids.add(addition.sourceBottleId)
      }
    }
  }
  return ids
}
