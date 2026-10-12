import { describe, expect, it } from 'vitest'
import type { Bottle, Pour } from '../../data/types'
import { buildPalateInsightText } from '../yourPalate/palateInsights'
import { buildAxePalateInsights } from './axePalate'

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open', type: 'Bourbon', proof: 90 },
  { id: 'b2', name: 'Rittenhouse', status: 'open', type: 'Rye', proof: 100 },
]

function pour(id: string, bottleId: string, rating: number, daysAgo: number, tags: string[] = []): Pour {
  return {
    id,
    bottleId,
    rating,
    date: new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10),
    fip: { nose: 2, palate: 2, finish: 2, complexity: 1, value: 1, total: rating, noseAromas: tags, palateFlavors: [] },
  }
}

describe('buildAxePalateInsights', () => {
  it('hands AXE exactly the sentences Your Palate shows', () => {
    const pours = [
      pour('p1', 'b1', 9, 1, ['Vanilla']),
      pour('p2', 'b1', 8.5, 5, ['Vanilla']),
      pour('p3', 'b1', 8.8, 9, ['Vanilla']),
      pour('p4', 'b2', 7, 12),
      pour('p5', 'b2', 7.2, 20),
    ]
    const ui = buildPalateInsightText(bottles, pours)!
    const axe = buildAxePalateInsights(bottles, pours)
    expect(axe.summary).toBe(ui.summaryText)
    expect(axe.patterns).toEqual(ui.tastePatterns)
    expect(axe.patterns.length).toBeGreaterThan(0)
    expect(axe.hasBaseline).toBe(true)
    expect(axe.qualifyingPourCount).toBe(3)
  })

  it('reports no data honestly instead of inventing insights', () => {
    expect(buildAxePalateInsights(bottles, [])).toEqual({
      pourCount: 0,
      hasBaseline: false,
      qualifyingPourCount: 0,
      maturity: 'learning',
      experiencedFlavors: [],
      preferredFlavors: [],
      patterns: [],
      trends: [],
    })
    const thin = buildAxePalateInsights(bottles, [pour('p1', 'b1', 8, 1)])
    expect(thin.hasBaseline).toBe(false)
    expect(thin.patterns).toEqual([])
  })
})
