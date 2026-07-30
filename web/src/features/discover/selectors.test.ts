import { describe, expect, it } from 'vitest'
import { getWishlistBottles, getTopRatedBottles, getDistilleryStats } from './selectors'
import type { Bottle, Pour } from '../../data/types'

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open', rating: 8.5, createdAt: 1 },
  { id: 'b2', name: 'Weller 12', distillery: 'Buffalo Trace', status: 'sealed', createdAt: 2 },
  { id: 'b3', name: 'Pappy 15', distillery: 'Old Rip Van Winkle', status: 'wishlist', priority: 2, createdAt: 3 },
  { id: 'b4', name: 'Blanton\'s', distillery: 'Buffalo Trace', status: 'wishlist', priority: 1, createdAt: 4 },
  { id: 'b5', name: 'No distillery bottle', status: 'sealed', createdAt: 5 },
]

const pours: Pour[] = [
  {
    id: 'p1',
    bottleId: 'b2',
    date: '2026-01-01',
    rating: 9.5,
    fip: { nose: 2.5, palate: 3.5, finish: 2, complexity: 1, value: 0.5, total: 9.5, noseAromas: [], palateFlavors: [] },
  },
]

describe('getWishlistBottles', () => {
  it('returns only wishlist bottles, sorted by priority first', () => {
    const result = getWishlistBottles(bottles)
    expect(result.map((b) => b.id)).toEqual(['b4', 'b3'])
  })
})

describe('getTopRatedBottles', () => {
  it('uses the latest pour score over the bottle rating field, sorted descending', () => {
    const result = getTopRatedBottles(bottles, pours)
    // b2 has a pour scoring 9.5 (overrides no bottle.rating), b1 has bottle.rating 8.5, others have no score at all
    expect(result.map((r) => r.bottle.id)).toEqual(['b2', 'b1'])
    expect(result[0]?.score).toBe(9.5)
  })

  it('respects the limit', () => {
    expect(getTopRatedBottles(bottles, pours, 1)).toHaveLength(1)
  })
})

describe('getDistilleryStats', () => {
  it('counts bottles per distillery, sorted descending, ignoring bottles with none', () => {
    expect(getDistilleryStats(bottles)).toEqual([{ name: 'Buffalo Trace', count: 3 }, { name: 'Old Rip Van Winkle', count: 1 }])
  })
})
