import { describe, expect, it } from 'vitest'
import { flavorRadarValues, collectionFlavorRadarValues, topFlavorTags, topFlavorTagPercentages, FLAVOR_AXES } from './flavorCategories'
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

describe('collectionFlavorRadarValues', () => {
  it('returns undefined for a collection with no recognized tags anywhere', () => {
    const bottleTwo: Bottle = { id: 'b2', name: 'Weller', status: 'open' }
    expect(collectionFlavorRadarValues([bottle, bottleTwo], [])).toBeUndefined()
  })

  it('aggregates flavor signal across every bottle, not just one', () => {
    const bottleTwo: Bottle = { id: 'b2', name: 'Weller', status: 'open', flavors: ['Oak'] }
    const pours = [pourFor('b1', ['Vanilla'], [])]
    const values = collectionFlavorRadarValues([bottle, bottleTwo], pours)
    expect(values).toBeDefined()
    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Sweet).toBeGreaterThan(0) // vanilla, from bottle b1's pour
    expect(byAxis.Woody).toBeGreaterThan(0) // oak, from bottle b2's own flavors field
  })
})

describe('topFlavorTags', () => {
  it('returns an empty list when there are no structured or free-text tags', () => {
    const bottleTwo: Bottle = { id: 'b2', name: 'Weller', status: 'open' }
    expect(topFlavorTags([bottle, bottleTwo], [])).toEqual([])
  })

  it('ranks a structured tag above a free-text tag even with fewer raw mentions', () => {
    // "Cherry" is tapped once as a structured chip; "Vanilla" is mentioned
    // three times in free-text notes. Structured still wins.
    const pours = [
      pourFor('b1', ['Cherry'], []),
      pourFor('b1', [], [], { noseNotes: 'vanilla' }),
      pourFor('b1', [], [], { palateNotes: 'vanilla' }),
      pourFor('b1', [], [], { finishNotes: 'vanilla' }),
    ]
    const ranked = topFlavorTags([bottle], pours)
    const cherry = ranked.find((r) => r.tag === 'Cherry')
    const vanilla = ranked.find((r) => r.tag === 'Vanilla')
    expect(cherry).toBeDefined()
    expect(vanilla).toBeDefined()
    expect(ranked.indexOf(cherry!)).toBeLessThan(ranked.indexOf(vanilla!))
    expect(cherry!.structuredCount).toBe(1)
    expect(vanilla!.freeTextCount).toBe(3)
  })

  it('still surfaces free-text-only tags when nothing structured exists', () => {
    const bottleWithNotes: Bottle = { ...bottle, notes: 'Tastes like caramel and leather.' }
    const ranked = topFlavorTags([bottleWithNotes], [])
    expect(ranked.map((r) => r.tag)).toEqual(expect.arrayContaining(['Caramel', 'Leather']))
    expect(ranked.every((r) => r.structuredCount === 0)).toBe(true)
  })

  it('respects the limit and orders ties alphabetically', () => {
    const bottleWithFlavors: Bottle = { ...bottle, flavors: ['Oak', 'Cherry', 'Honey'] }
    const ranked = topFlavorTags([bottleWithFlavors], [], 2)
    expect(ranked).toHaveLength(2)
    expect(ranked.map((r) => r.tag)).toEqual(['Cherry', 'Honey']) // alphabetical among equal structuredCount=1 ties
  })
})

describe('topFlavorTagPercentages', () => {
  it('returns an empty list when there is no tagged data at all', () => {
    expect(topFlavorTagPercentages([bottle], [])).toEqual([])
  })

  it('computes real percentages that sum to the same total mention count — never invented numbers', () => {
    // 3 Sweet mentions (Vanilla x2, Caramel x1), 1 Woody mention (Oak) — 4 total.
    const bottleWithFlavors: Bottle = { ...bottle, flavors: ['Vanilla', 'Caramel'] }
    const pours = [pourFor('b1', ['Vanilla'], []), pourFor('b1', ['Oak'], [])]
    const percentages = topFlavorTagPercentages([bottleWithFlavors], pours)

    const vanilla = percentages.find((p) => p.tag === 'Vanilla')
    const caramel = percentages.find((p) => p.tag === 'Caramel')
    const oak = percentages.find((p) => p.tag === 'Oak')

    expect(vanilla).toEqual({ tag: 'Vanilla', count: 2, percent: 50 })
    expect(caramel).toEqual({ tag: 'Caramel', count: 1, percent: 25 })
    expect(oak).toEqual({ tag: 'Oak', count: 1, percent: 25 })
  })

  it('respects the limit, keeping the highest-count tags first', () => {
    const bottleWithFlavors: Bottle = { ...bottle, flavors: ['Oak', 'Cherry', 'Honey', 'Vanilla'] }
    const percentages = topFlavorTagPercentages([bottleWithFlavors], [], 2)
    expect(percentages).toHaveLength(2)
  })
})
