import { describe, expect, it } from 'vitest'
import { flavorRadarValues, FLAVOR_AXES } from './flavorCategories'
import type { Bottle, Pour } from '../../data/types'

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }

function pourFor(
  bottleId: string,
  noseAromas: string[],
  palateFlavors: string[],
  notes: { noseNotes?: string; palateNotes?: string; finishNotes?: string; complexityNotes?: string } = {},
): Pour {
  return {
    id: `p-${Math.random()}`,
    bottleId,
    date: '2026-01-01',
    rating: 8,
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: 8, noseAromas, palateFlavors, ...notes },
  }
}

describe('flavorRadarValues', () => {
  it('returns undefined when there are no recognized tags anywhere', () => {
    expect(flavorRadarValues(bottle, [])).toBeUndefined()
  })

  it('ignores pours for other bottles', () => {
    const otherBottlePour = pourFor('b2', ['Vanilla'], [])
    expect(flavorRadarValues(bottle, [otherBottlePour])).toBeUndefined()
  })

  it('weights the dominant category as 1 and scales the rest relative to it', () => {
    // Sweet: Vanilla, Caramel, Honey (x3) — Woody: Oak (x1)
    const pours = [pourFor('b1', ['Vanilla', 'Caramel'], ['Honey']), pourFor('b1', ['Oak'], [])]
    const values = flavorRadarValues(bottle, pours)
    expect(values).toBeDefined()
    expect(values).toHaveLength(FLAVOR_AXES.length)

    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Sweet).toBe(1)
    expect(byAxis.Woody).toBeCloseTo(1 / 3)
    expect(byAxis.Spicy).toBe(0)
  })

  it('includes the legacy per-bottle flavors field alongside pour tags', () => {
    const bottleWithFlavors: Bottle = { ...bottle, flavors: ['Cherry'] }
    const values = flavorRadarValues(bottleWithFlavors, [])
    expect(values).toBeDefined()
    const fruityIndex = FLAVOR_AXES.indexOf('Fruity')
    expect(values?.[fruityIndex]).toBe(1)
  })

  it('picks up flavor words written in free-text tasting notes, not just tapped chips', () => {
    const pours = [pourFor('b1', [], [], { noseNotes: 'hints of vanilla and oak', palateNotes: 'a little black pepper' })]
    const values = flavorRadarValues(bottle, pours)
    expect(values).toBeDefined()

    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Sweet).toBeGreaterThan(0) // vanilla
    expect(byAxis.Woody).toBeGreaterThan(0) // oak
    expect(byAxis.Spicy).toBeGreaterThan(0) // black pepper
  })

  it('picks up flavor words from the bottle-level notes field', () => {
    const bottleWithNotes: Bottle = { ...bottle, notes: 'Tastes like caramel and leather.' }
    const values = flavorRadarValues(bottleWithNotes, [])
    expect(values).toBeDefined()

    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Sweet).toBeGreaterThan(0) // caramel
    expect(byAxis.Smoky).toBeGreaterThan(0) // leather
  })

  it('does not false-positive match a tag word inside an unrelated word', () => {
    // "oak" should not match inside "soak"
    const bottleWithNotes: Bottle = { ...bottle, notes: 'Let it soak in the glass a while.' }
    expect(flavorRadarValues(bottleWithNotes, [])).toBeUndefined()
  })
})
