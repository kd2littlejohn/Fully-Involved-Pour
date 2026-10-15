import { describe, expect, it } from 'vitest'
import { withSavedTastings } from './savedTastingsPalate'
import { buildPalateProfile } from './palateProfile'
import type { Bottle, Pour, SavedTasting } from '../../data/types'

function tasting(overrides: Partial<SavedTasting> = {}): SavedTasting {
  return {
    id: 'party:p1:c1:A',
    source: 'party',
    format: 'blind',
    partyId: 'p1',
    eventName: 'Night',
    categoryId: 'c1',
    categoryName: 'Rye',
    label: 'A',
    date: '2026-10-10',
    bottle: { name: 'Pikesville', type: 'Rye', proof: 110 },
    overall: 9,
    nose: 8,
    palate: 10,
    finish: 5,
    complexity: 10,
    descriptors: ['Cherry', 'Baking Spice'],
    favorite: true,
    savedAt: 1,
    ...overrides,
  }
}

describe('withSavedTastings', () => {
  it('changes nothing without saved tastings', () => {
    const bottles: Bottle[] = [{ id: 'b', name: 'X', status: 'open' }]
    const pours: Pour[] = []
    expect(withSavedTastings(bottles, pours, undefined)).toEqual({ bottles, pours })
  })

  it('maps scores onto the FIP rubric and keeps the overall rating as given', () => {
    const { pours } = withSavedTastings([], [], [tasting()])
    expect(pours[0]).toMatchObject({ id: 'party:p1:c1:A', date: '2026-10-10', rating: 9 })
    expect(pours[0]!.fip).toMatchObject({ nose: 2, palate: 3.5, finish: 1, complexity: 1, value: 0, total: 9, palateFlavors: ['Cherry', 'Baking Spice'] })
  })

  it('uses your own My Bar bottle when linked, and one stand-in per unowned bottle otherwise', () => {
    const bar: Bottle[] = [{ id: 'mine', name: 'Pikesville', type: 'Rye', status: 'open' }]
    const linked = withSavedTastings(bar, [], [tasting({ bottleId: 'mine' })])
    expect(linked.bottles).toHaveLength(1)
    expect(linked.pours[0]!.bottleId).toBe('mine')

    const unowned = withSavedTastings([], [], [tasting({ id: 'x1' }), tasting({ id: 'x2', label: 'B' }), tasting({ id: 'x3', bottle: { name: 'Weller' } })])
    expect(unowned.bottles.map((b) => b.name).sort()).toEqual(['Pikesville', 'Weller'])
    expect(new Set(unowned.pours.map((p) => p.bottleId)).size).toBe(2)
    // A link to a bottle that's no longer in the bar falls back to a stand-in.
    expect(withSavedTastings([], [], [tasting({ bottleId: 'gone' })]).pours[0]!.bottleId).toMatch(/^tasting-bottle:/)
  })

  it('counts toward the palate tracker like any qualifying pour', () => {
    const before = buildPalateProfile([], [])
    const merged = withSavedTastings([], [], [tasting()])
    const after = buildPalateProfile(merged.bottles, merged.pours)
    expect(before.qualifyingPourCount).toBe(0)
    expect(after.qualifyingPourCount).toBe(1)
  })
})
