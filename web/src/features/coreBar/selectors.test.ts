import { describe, expect, it } from 'vitest'
import { computeCoreBarScore, getCoreBarBottles } from './selectors'
import type { Bottle, Pour } from '../../data/types'

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open', rating: 9 },
  { id: 'b2', name: 'Weller 12', status: 'open', rating: 8 },
  { id: 'b3', name: 'Never poured', status: 'sealed' },
]

const pours: Pour[] = [
  { id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 9, fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: 9, noseAromas: [], palateFlavors: [] } },
  { id: 'p2', bottleId: 'b1', date: '2026-01-05', rating: 9, fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: 9, noseAromas: [], palateFlavors: [] } },
  { id: 'p3', bottleId: 'b1', date: '2026-01-10', rating: 9, fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: 9, noseAromas: [], palateFlavors: [] } },
  { id: 'p4', bottleId: 'b2', date: '2026-01-01', rating: 8, fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: 8, noseAromas: [], palateFlavors: [] } },
]

describe('computeCoreBarScore', () => {
  it('is zero for a bottle with no pours', () => {
    expect(computeCoreBarScore(bottles[2] as Bottle, pours)).toBe(0)
  })

  it('rewards both frequency and score', () => {
    const eagleScore = computeCoreBarScore(bottles[0] as Bottle, pours) // 3 pours * 0.9
    const wellerScore = computeCoreBarScore(bottles[1] as Bottle, pours) // 1 pour * 0.8
    expect(eagleScore).toBeGreaterThan(wellerScore)
  })
})

describe('getCoreBarBottles', () => {
  it('excludes bottles with zero score and sorts descending', () => {
    const result = getCoreBarBottles(bottles, pours)
    expect(result.map((b) => b.id)).toEqual(['b1', 'b2'])
  })

  it('respects the limit', () => {
    expect(getCoreBarBottles(bottles, pours, 1)).toHaveLength(1)
  })
})
