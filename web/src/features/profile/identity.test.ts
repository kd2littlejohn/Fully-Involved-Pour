import { describe, expect, it } from 'vitest'
import { getWhiskeyIdentity } from './identity'
import type { Bottle, Pour } from '../../data/types'

function pour(id: string, bottleId: string, date: string, rating: number): Pour {
  return {
    id,
    bottleId,
    date,
    rating,
    fip: { nose: 1.5, palate: 2, finish: 1.5, complexity: 0.5, value: 0.5, total: rating, noseAromas: [], palateFlavors: [] },
  }
}

describe('getWhiskeyIdentity', () => {
  it('returns undefined below the minimum pour baseline — no confident identity from almost no data', () => {
    const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open', type: 'Bourbon', proof: 90 }]
    const pours: Pour[] = [pour('p1', 'b1', '2026-01-01', 9), pour('p2', 'b1', '2026-01-02', 8)]
    expect(getWhiskeyIdentity(bottles, pours)).toBeUndefined()
  })

  it('returns undefined above the pour baseline when there is no real signal to describe — never fabricates tags', () => {
    const bottles: Bottle[] = [{ id: 'b1', name: 'Mystery', status: 'open' }]
    const pours: Pour[] = [pour('p1', 'b1', '2026-01-01', 8), pour('p2', 'b1', '2026-01-02', 8), pour('p3', 'b1', '2026-01-03', 8)]
    expect(getWhiskeyIdentity(bottles, pours)).toBeUndefined()
  })

  it('builds tags and a description entirely from real selector outputs once there is a baseline', () => {
    const bottles: Bottle[] = [
      { id: 'b1', name: 'Eagle Rare', status: 'open', type: 'Bourbon', proof: 100, flavors: ['Vanilla'] },
      { id: 'b2', name: 'Weller 12', status: 'open', type: 'Bourbon', proof: 107, flavors: ['Caramel'] },
    ]
    const pours: Pour[] = [pour('p1', 'b1', '2026-01-01', 9), pour('p2', 'b1', '2026-01-02', 8.5), pour('p3', 'b2', '2026-01-03', 9)]
    const identity = getWhiskeyIdentity(bottles, pours)
    expect(identity).toBeDefined()
    expect(identity!.tags.length).toBeGreaterThan(0)
    expect(identity!.tags).toContain('Bourbon')
    expect(identity!.description).toContain('Bourbon')
  })

  it('never claims "Rich" or "Complex" unless the FIP component averages actually support it', () => {
    const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open', type: 'Bourbon' }]
    const pours: Pour[] = [pour('p1', 'b1', '2026-01-01', 6), pour('p2', 'b1', '2026-01-02', 6), pour('p3', 'b1', '2026-01-03', 6)]
    const identity = getWhiskeyIdentity(bottles, pours)
    expect(identity?.tags).not.toContain('Rich')
    expect(identity?.tags).not.toContain('Complex')
  })
})
