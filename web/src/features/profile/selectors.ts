import type { Bottle, Pour } from '../../data/types'
import { getPoursForBottle } from '../bottleDetails/selectors'

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
