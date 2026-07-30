import type { Bottle, Pour } from '../../data/types'
import { getCurrentScore } from '../bottleDetails/selectors'

// All of these are derived strictly from the user's own real collection —
// no external whiskey database, no cross-user trending, no store-locator
// data exists yet, so Discover only surfaces what's actually knowable.

export function getWishlistBottles(bottles: Bottle[]): Bottle[] {
  return [...bottles]
    .filter((b) => b.status === 'wishlist')
    .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity) || (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export interface RatedBottle {
  bottle: Bottle
  score: number
}

export function getTopRatedBottles(bottles: Bottle[], pours: Pour[], limit = 6): RatedBottle[] {
  return bottles
    .map((bottle) => ({ bottle, score: getCurrentScore(bottle, pours) }))
    .filter((entry): entry is RatedBottle => typeof entry.score === 'number')
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export interface DistilleryStat {
  name: string
  count: number
}

export function getDistilleryStats(bottles: Bottle[]): DistilleryStat[] {
  const counts = new Map<string, number>()
  for (const bottle of bottles) {
    const name = bottle.distillery?.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}
