import type { Bottle, Pour } from '../../data/types'
import { getCurrentScore, getPoursForBottle } from '../bottleDetails/selectors'

export interface CollectionStats {
  totalBottles: number
  openBottles: number
  sealedBottles: number
  wishlistBottles: number
  finishedBottles: number
  totalPours: number
  totalMemories: number
}

export function getCollectionStats(bottles: Bottle[], pours: Pour[], memoriesCount: number): CollectionStats {
  return {
    totalBottles: bottles.length,
    openBottles: bottles.filter((b) => b.status === 'open').length,
    sealedBottles: bottles.filter((b) => b.status === 'sealed').length,
    wishlistBottles: bottles.filter((b) => b.status === 'wishlist').length,
    finishedBottles: bottles.filter((b) => b.status === 'finished').length,
    totalPours: pours.length,
    totalMemories: memoriesCount,
  }
}

export function getAverageProof(bottles: Bottle[]): number | undefined {
  const proofs = bottles.map((b) => b.proof).filter((p): p is number => typeof p === 'number')
  if (proofs.length === 0) return undefined
  return proofs.reduce((sum, p) => sum + p, 0) / proofs.length
}

export interface FlavorStat {
  name: string
  count: number
}

export function getFavoriteFlavors(bottles: Bottle[], limit = 6): FlavorStat[] {
  const counts = new Map<string, number>()
  for (const bottle of bottles) {
    for (const flavor of bottle.flavors ?? []) {
      counts.set(flavor, (counts.get(flavor) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export interface SharedBottleStat {
  bottle: Bottle
  sharedPourCount: number
}

// "Most shared" = the bottle with the most pours that had a companion
// logged — derived entirely from existing Pour.companion data.
export function getMostSharedBottle(bottles: Bottle[], pours: Pour[]): SharedBottleStat | undefined {
  let best: SharedBottleStat | undefined
  for (const bottle of bottles) {
    const sharedCount = getPoursForBottle(pours, bottle.id).filter((p) => p.companion?.trim()).length
    if (sharedCount === 0) continue
    if (!best || sharedCount > best.sharedPourCount) {
      best = { bottle, sharedPourCount: sharedCount }
    }
  }
  return best
}

export function getLegacyShelfBottles(bottles: Bottle[]): Bottle[] {
  return bottles.filter((b) => b.legacyShelf)
}

// The user's own explicit favorite flag (see YourTakeCard's "Add to
// Favorites" toggle, already live on Bottle Details) — never a guess. Among
// favorited bottles, the highest current score wins; ties break to the most
// recently added.
export function getFavoriteBottle(bottles: Bottle[], pours: Pour[]): Bottle | undefined {
  const favorited = bottles.filter((b) => b.favorite)
  if (favorited.length === 0) return undefined
  return [...favorited].sort((a, b) => {
    const scoreA = getCurrentScore(a, pours)
    const scoreB = getCurrentScore(b, pours)
    // Infinity - Infinity is NaN, not 0 — comparing two unscored bottles
    // with the naive `?? -Infinity` subtraction broke the createdAt
    // tiebreak below entirely. Handle "no score" explicitly instead.
    if (scoreA !== scoreB) {
      if (scoreA === undefined) return 1
      if (scoreB === undefined) return -1
      return scoreB - scoreA
    }
    return (b.createdAt ?? 0) - (a.createdAt ?? 0)
  })[0]
}
