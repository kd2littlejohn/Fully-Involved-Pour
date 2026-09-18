import { describe, expect, it } from 'vitest'
import {
  flavorRadarValues,
  collectionFlavorRadarValues,
  dominantFlavorAxis,
  topFlavorTags,
  topFlavorTagPercentages,
  identityLabelForAxis,
  FLAVOR_AXES,
} from './flavorCategories'
import type { Bottle, Pour } from '../../data/types'

// One representative, unambiguous descriptor per family (Fruit/Nutty/Grain/
// Herbal are entries that did not exist as radar axes before this feature).
const REPRESENTATIVE_DESCRIPTOR: Record<string, string> = {
  Sweet: 'Vanilla',
  Fruit: 'Peach',
  Spice: 'Ginger',
  Oak: 'Cedar',
  Nutty: 'Almond',
  Grain: 'Malt',
  Herbal: 'Rose',
  Smoke: 'Peat',
}

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
    // Sweet: Vanilla, Caramel, Honey (x3) — Oak: Oak (x1)
    const pours = [pourFor('b1', ['Vanilla', 'Caramel'], ['Honey']), pourFor('b1', ['Oak'], [])]
    const values = flavorRadarValues(bottle, pours)
    expect(values).toBeDefined()
    expect(values).toHaveLength(FLAVOR_AXES.length)

    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Sweet).toBe(1)
    expect(byAxis.Oak).toBeCloseTo(1 / 3)
    expect(byAxis.Spice).toBe(0)
  })

  it('includes the legacy per-bottle flavors field alongside pour tags', () => {
    const bottleWithFlavors: Bottle = { ...bottle, flavors: ['Cherry'] }
    const values = flavorRadarValues(bottleWithFlavors, [])
    expect(values).toBeDefined()
    const fruitIndex = FLAVOR_AXES.indexOf('Fruit')
    expect(values?.[fruitIndex]).toBe(1)
  })

  it('picks up flavor words written in free-text tasting notes, not just tapped chips', () => {
    const pours = [pourFor('b1', [], [], { noseNotes: 'hints of vanilla and oak', palateNotes: 'a little black pepper' })]
    const values = flavorRadarValues(bottle, pours)
    expect(values).toBeDefined()

    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Sweet).toBeGreaterThan(0) // vanilla
    expect(byAxis.Oak).toBeGreaterThan(0) // oak
    expect(byAxis.Spice).toBeGreaterThan(0) // black pepper
  })

  it('picks up flavor words from the bottle-level notes field', () => {
    const bottleWithNotes: Bottle = { ...bottle, notes: 'Tastes like caramel and leather.' }
    const values = flavorRadarValues(bottleWithNotes, [])
    expect(values).toBeDefined()

    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Sweet).toBeGreaterThan(0) // caramel
    expect(byAxis.Oak).toBeGreaterThan(0) // leather
  })

  it('a descriptor absent from the old 5-axis mapping now moves the radar (regression test for the reported bug)', () => {
    // "Pecan" (Nutty) and "Peach" (Fruit) never existed in the old TAG_AXIS —
    // before this fix they were selectable chips that silently never
    // affected the radar.
    const pours = [pourFor('b1', ['Pecan'], ['Peach'])]
    const values = flavorRadarValues(bottle, pours)
    expect(values).toBeDefined()
    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Nutty).toBeGreaterThan(0)
    expect(byAxis.Fruit).toBeGreaterThan(0)
  })

  it('counts a descriptor once per pour even when both selected as a chip and typed in notes', () => {
    const pours = [pourFor('b1', ['Vanilla'], [], { noseNotes: 'hints of vanilla' })]
    const ranked = topFlavorTags([bottle], pours)
    const vanilla = ranked.find((r) => r.tag === 'Vanilla')
    expect(vanilla).toBeDefined()
    // Counted once, as a structured pick (not once structured + once free-text).
    expect(vanilla!.structuredCount).toBe(1)
    expect(vanilla!.freeTextCount).toBe(0)

    const percentages = topFlavorTagPercentages([bottle], pours)
    expect(percentages.find((p) => p.tag === 'Vanilla')?.count).toBe(1)
  })

  it('counts a descriptor once per pour even when it appears in two different note fields', () => {
    const pours = [pourFor('b1', [], [], { noseNotes: 'vanilla', palateNotes: 'vanilla' })]
    const percentages = topFlavorTagPercentages([bottle], pours)
    expect(percentages.find((p) => p.tag === 'Vanilla')?.count).toBe(1)
  })

  it('a secondary-weighted descriptor moves both its families on the radar without breaking label percentages', () => {
    // Mint: primary Herbal/Floral, secondary Spice (half-weighted).
    const pours = [pourFor('b1', ['Mint'], [])]
    const values = flavorRadarValues(bottle, pours)
    expect(values).toBeDefined()
    const byAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, values?.[i]]))
    expect(byAxis.Herbal).toBeGreaterThan(0)
    expect(byAxis.Spice).toBeGreaterThan(0)
    expect(byAxis.Herbal).toBeGreaterThan(byAxis.Spice ?? 0) // primary outweighs secondary

    // Label-level percentages are per-label, never per-family — one Mint
    // mention is still exactly one mention, 100% of the total.
    const percentages = topFlavorTagPercentages([bottle], pours)
    expect(percentages).toEqual([{ tag: 'Mint', count: 1, percent: 100 }])
  })

  it('a flavor-mapped Finish tag moves its axis; a purely-textural one moves nothing', () => {
    const oakyPours = [pourFor('b1', [], [], {})]
    oakyPours[0]!.fip.finishTags = ['Oaky']
    const oakyValues = flavorRadarValues(bottle, oakyPours)
    expect(oakyValues).toBeDefined()
    const oakyByAxis = Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, oakyValues?.[i]]))
    expect(oakyByAxis.Oak).toBeGreaterThan(0)

    const longPours = [pourFor('b1', [], [], {})]
    longPours[0]!.fip.finishTags = ['Long']
    expect(flavorRadarValues(bottle, longPours)).toBeUndefined()
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
    expect(byAxis.Oak).toBeGreaterThan(0) // oak, from bottle b2's own flavors field
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
    // 3 Sweet mentions (Vanilla x2, Caramel x1), 1 Oak mention (Oak) — 4 total.
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

// Every one of the 8 possible dominant axes — including the 3 net-new ones
// (Nutty/Grain/Herbal) that had no radar axis at all before this feature —
// must behave correctly end to end, not just typecheck. A hand-written
// Record<FlavorAxis, string> could silently return the wrong (but still
// type-valid) string for one key, so this is real runtime assertions, not
// a type-only check.
describe('every dominant axis produces valid, well-formed output', () => {
  for (const axis of FLAVOR_AXES) {
    it(`${axis}: identityLabelForAxis returns a real, non-empty label`, () => {
      const label = identityLabelForAxis(axis)
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toContain('undefined')
    })

    it(`${axis}: flavorRadarValues/dominantFlavorAxis return well-formed 8-length output`, () => {
      const descriptor = REPRESENTATIVE_DESCRIPTOR[axis]!
      const bottleWithFlavor: Bottle = { ...bottle, flavors: [descriptor] }

      const values = flavorRadarValues(bottleWithFlavor, [])
      expect(values).toBeDefined()
      expect(values).toHaveLength(FLAVOR_AXES.length)
      expect(values!.every((v) => Number.isFinite(v))).toBe(true)

      const dominant = dominantFlavorAxis([bottleWithFlavor], [])
      expect(dominant).toBeDefined()
      expect(dominant!.axis).toBe(axis)
      expect(Number.isFinite(dominant!.percent)).toBe(true)
    })
  }
})
