import { describe, expect, it } from 'vitest'
import type { Bottle, Pour } from '../../data/types'
import { buildAxePalateInsights } from '../sommelier/axePalate'
import { buildPalateInsightText, PREFERRED_FLAVORS_PENDING_NOTE } from './palateInsights'
import { buildPalateProfile } from './palateProfile'
import { getPalateInsight } from '../home/selectors'
import { topFlavorTagPercentages, tastedBottles } from '../flavorRadar/flavorCategories'

// Combined behavior of the AXE release (legacy-pour safety, shared insights
// for AXE) and Palate Tracker accuracy (tasted bottles only, preferred vs
// experienced flavors) — the two must hold together.

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}

function pour(id: string, bottleId: string, rating: number, daysBack: number, noseAromas: string[] = []): Pour {
  return {
    id,
    bottleId,
    rating,
    date: daysAgo(daysBack),
    fip: { nose: 2, palate: 2, finish: 2, complexity: 1, value: 1, total: rating, noseAromas, palateFlavors: [] },
  }
}

// Rated 9, but saved by the legacy guided tasting with no fip at all.
const legacy = { id: 'legacy', bottleId: 'b1', date: daysAgo(60), rating: 9, notes: 'Guided tasting' } as unknown as Pour

const eagle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', type: 'Bourbon', proof: 90 }
const weller: Bottle = { id: 'b2', name: 'Weller 12', status: 'open', type: 'Bourbon', proof: 90 }
// Never poured — its own notes must not count as tasting history.
const sealed: Bottle = { id: 'b9', name: 'Sealed Unicorn', status: 'sealed', type: 'Rye', proof: 120, flavors: ['Smoke'], notes: 'Peat and smoke' }

describe('combined palate behavior', () => {
  it('a single favorite bottle poured often is "experienced", never "preferred" — on screen and in AXE', () => {
    const pours = [legacy, pour('p1', 'b1', 9, 1, ['Vanilla']), pour('p2', 'b1', 9, 3, ['Vanilla']), pour('p3', 'b1', 8.5, 5, ['Vanilla'])]
    const ui = buildPalateInsightText([eagle, sealed], pours)!
    expect(ui.experiencedFlavors.map((f) => f.tag)).toContain('Vanilla')
    expect(ui.preferredFlavors).toEqual([])
    expect(ui.preferredFlavorsNote).toBe(PREFERRED_FLAVORS_PENDING_NOTE)
    // The old "highest-rated pours tend to have…" sentence must not sneak a preference back in.
    expect(ui.tastePatterns.join(' ')).not.toMatch(/tend to have/)

    const axe = buildAxePalateInsights([eagle, sealed], pours)
    expect(axe.preferredFlavors).toEqual([])
    expect(axe.preferredFlavorsNote).toBe(PREFERRED_FLAVORS_PENDING_NOTE)
    expect(axe.experiencedFlavors).toEqual(ui.experiencedFlavors.map((f) => f.tag))
  })

  it('reports a preference only across 2+ different high-rated bottles, identically for the UI, AXE and the AI interpretation', () => {
    const pours = [legacy, pour('p1', 'b1', 9, 1, ['Vanilla']), pour('p2', 'b2', 8.5, 2, ['Vanilla']), pour('p3', 'b2', 8.2, 4, ['Caramel'])]
    const ui = buildPalateInsightText([eagle, weller, sealed], pours)!
    const axe = buildAxePalateInsights([eagle, weller, sealed], pours)
    const profile = buildPalateProfile([eagle, weller, sealed], pours)
    expect(ui.preferredFlavors[0]).toEqual({ tag: 'Vanilla', bottleCount: 2 })
    expect(ui.preferredFlavorsNote).toBeUndefined()
    expect(axe.preferredFlavors).toEqual(ui.preferredFlavors.map((f) => f.tag))
    expect(profile.topRatedFlavors).toEqual(ui.preferredFlavors)
  })

  it("never counts an untasted bottle's notes, and never crashes on legacy pours, across every palate surface", () => {
    const pours = [legacy, pour('p1', 'b1', 8, 1, ['Vanilla']), pour('p2', 'b1', 8, 2, ['Vanilla']), pour('p3', 'b1', 8, 3, ['Oak'])]
    const bottles = [eagle, sealed]
    const ui = buildPalateInsightText(bottles, pours)!
    const tags = ui.experiencedFlavors.map((f) => f.tag)
    expect(tags).not.toContain('Smoke')
    expect(tags).not.toContain('Peat')
    expect(ui.stats.pourCount).toBe(4) // the legacy pour still counts toward the summary
    // Profile → Palate Breakdown and the Home card read the same tasted-only data.
    const breakdown = topFlavorTagPercentages(tastedBottles(bottles, pours), pours, 5).map((p) => p.tag)
    expect(breakdown).not.toContain('Smoke')
    expect(() => getPalateInsight(bottles, pours)).not.toThrow()
  })

  it('stores nothing: building insights never mutates the pours passed in', () => {
    const pours = [legacy, pour('p1', 'b1', 9, 1, ['Vanilla'])]
    const before = JSON.stringify(pours)
    buildPalateInsightText([eagle], pours)
    buildAxePalateInsights([eagle], pours)
    expect(JSON.stringify(pours)).toBe(before)
    expect('fip' in pours[0]!).toBe(false)
  })
})
