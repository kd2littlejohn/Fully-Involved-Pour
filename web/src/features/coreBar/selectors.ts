import type { Bottle, Pour } from '../../data/types'
import { getCurrentScore, getPoursForBottle } from '../bottleDetails/selectors'

// Core Bar = the bottles you actually reach for, computed from real usage —
// pour frequency weighted by how highly you've rated it — rather than a
// manually-set flag. No schema change: bottle.coreBar/coreBarScore exist in
// the type for compatibility but aren't required; we compute fresh instead.
export function computeCoreBarScore(bottle: Bottle, pours: Pour[]): number {
  const bottlePours = getPoursForBottle(pours, bottle.id)
  if (bottlePours.length === 0) return 0
  const score = getCurrentScore(bottle, pours) ?? 0
  return bottlePours.length * (score / 10)
}

export function getCoreBarBottles(bottles: Bottle[], pours: Pour[], limit = 5): Bottle[] {
  return [...bottles]
    .map((bottle) => ({ bottle, score: computeCoreBarScore(bottle, pours) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.bottle)
}
