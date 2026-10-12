import { describe, expect, it } from 'vitest'
import {
  getMaybeTonightCandidates,
  getPalateInsight,
  getOpenBottles,
  getCollectionSnapshot,
  FLAVOR_NOTE_BALANCED,
  FLAVOR_NOTE_NEEDS_TAGS,
} from './selectors'
import { buildPalateInsightText } from '../yourPalate/palateInsights'
import type { Bottle, Pour } from '../../data/types'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)
}

function minFip(rating: number) {
  return { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: rating, noseAromas: [], palateFlavors: [] }
}

describe('getMaybeTonightCandidates', () => {
  it('includes a sealed bottle with an honest "still sealed" reason', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Sealed Bottle', status: 'sealed', createdAt: 1 }]
    const result = getMaybeTonightCandidates(bottles, [])
    expect(result).toEqual([{ bottle: bottles[0], reason: 'Still sealed.' }])
  })

  it('excludes incoming, finished, and wishlist bottles', () => {
    const bottles: Bottle[] = [
      { id: 'a', name: 'Incoming', status: 'incoming', createdAt: 1 },
      { id: 'b', name: 'Finished', status: 'finished', createdAt: 1 },
      { id: 'c', name: 'Wishlist', status: 'wishlist', createdAt: 1 },
    ]
    expect(getMaybeTonightCandidates(bottles, [])).toEqual([])
  })

  it('surfaces an open bottle not poured in 14+ days, with the real day count in the reason', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Stale', status: 'open', createdAt: 1 }]
    const pours: Pour[] = [{ id: 'p1', bottleId: 'a', date: daysAgo(31), rating: 8, fip: minFip(8) }]

    const result = getMaybeTonightCandidates(bottles, pours)

    expect(result).toHaveLength(1)
    expect(result[0]?.reason).toBe("You haven't poured this in 31 days.")
  })

  it('excludes an open bottle poured recently', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Fresh', status: 'open', createdAt: 1 }]
    const pours: Pour[] = [{ id: 'p1', bottleId: 'a', date: daysAgo(2), rating: 8, fip: minFip(8) }]
    expect(getMaybeTonightCandidates(bottles, pours)).toEqual([])
  })

  it('falls back to favorites and highly-rated bottles once stale/sealed candidates run out', () => {
    const bottles: Bottle[] = [
      { id: 'fav', name: 'Favorite', status: 'open', favorite: true, createdAt: 1 },
      { id: 'top', name: 'Top Rated', status: 'open', rating: 9.5, createdAt: 2 },
    ]
    const pours: Pour[] = [
      { id: 'p1', bottleId: 'fav', date: daysAgo(1), rating: 9, fip: minFip(9) },
      { id: 'p2', bottleId: 'top', date: daysAgo(1), rating: 9.5, fip: minFip(9.5) },
    ]

    const result = getMaybeTonightCandidates(bottles, pours)

    expect(result).toEqual(
      expect.arrayContaining([
        { bottle: bottles[0], reason: 'One of your favorites.' },
        { bottle: bottles[1], reason: 'One of your higher-rated bottles.' },
      ]),
    )
  })

  it('never lists the same bottle twice even if it qualifies under multiple reasons', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Sealed Favorite', status: 'sealed', favorite: true, createdAt: 1 }]
    expect(getMaybeTonightCandidates(bottles, [])).toHaveLength(1)
  })

  it('respects the limit', () => {
    const bottles: Bottle[] = [
      { id: 'a', name: 'A', status: 'sealed', createdAt: 1 },
      { id: 'b', name: 'B', status: 'sealed', createdAt: 2 },
      { id: 'c', name: 'C', status: 'sealed', createdAt: 3 },
    ]
    expect(getMaybeTonightCandidates(bottles, [], 2)).toHaveLength(2)
  })
})

describe('getPalateInsight', () => {
  const bourbon: Bottle = { id: 'a', name: 'Eagle Rare', status: 'open', type: 'Bourbon', proof: 90, createdAt: 1 }
  const rye: Bottle = { id: 'b', name: 'Rittenhouse', status: 'open', type: 'Rye', proof: 100, createdAt: 2 }
  const tagged = (id: string, bottleId: string, days: number, rating: number, flavors: string[]): Pour => ({
    id,
    bottleId,
    date: daysAgo(days),
    rating,
    fip: { ...minFip(rating), palateFlavors: flavors },
  })

  it('shows the empty state only when there are no pours at all', () => {
    expect(getPalateInsight([bourbon], [])).toBeUndefined()
  })

  it('surfaces the dominant flavor family once one clearly leads recent tasted pours', () => {
    const pours = Array.from({ length: 5 }, (_, i) => tagged(`p${i}`, 'a', i, 8, ['Oak']))
    expect(getPalateInsight([bourbon], pours)).toEqual({
      kind: 'flavor',
      headline: 'Oak-Forward notes have come up in most of your last 5 tasted pours.',
      primaryLabel: 'Oak-Forward',
      primaryPercent: 100,
      secondaryLabel: 'All Other Profiles',
      secondaryPercent: 0,
    })
  })

  // Regression: each of these real-world histories used to show "Keep logging
  // pours and your palate trends will appear here." despite real data.
  it('4 well-tagged pours (below the old 5-pour minimum) get a flavor headline', () => {
    const pours = [0, 1, 2, 3].map((i) => tagged(`p${i}`, 'a', i, 8.5, ['Vanilla', 'Caramel']))
    const insight = getPalateInsight([bourbon], pours)
    expect(insight?.kind).toBe('flavor')
    expect(insight?.headline).toBe('Sweet notes have come up in most of your last 4 tasted pours.')
  })

  it('rating-only pours (Quick Pours with no flavor tags) get the rating-based summary, with no invented flavors', () => {
    const pours: Pour[] = Array.from({ length: 12 }, (_, i) => ({
      id: `q${i}`,
      bottleId: i % 2 ? 'a' : 'b',
      date: daysAgo(i * 3),
      rating: 7 + (i % 3),
      fip: minFip(7),
    }))
    const insight = getPalateInsight([bourbon, rye], pours)
    expect(insight?.kind).toBe('summary')
    if (insight?.kind !== 'summary') return
    // Same validated summary Profile → Your Palate shows.
    expect(insight.headline).toBe(buildPalateInsightText([bourbon, rye], pours)!.summaryText)
    expect(insight.headline).toBe("You've logged 12 pours so far, averaging 8.0 — Working Fire.")
    expect(insight.details.length).toBeGreaterThan(0)
    expect(insight.details.length).toBeLessThanOrEqual(2)
    expect(insight.flavorNote).toBe(FLAVOR_NOTE_NEEDS_TAGS)
    expect(JSON.stringify(insight)).not.toMatch(/notes have come up|Sweet|Oak|Vanilla|Spic|Fruit/)
  })

  it('a varied palate with no dominant family gets the summary, not the empty state', () => {
    const pours = Array.from({ length: 8 }, (_, i) => tagged(`v${i}`, 'a', i, 8, [['Vanilla'], ['Oak'], ['Cinnamon'], ['Cherry']][i % 4]!))
    const insight = getPalateInsight([bourbon], pours)
    expect(insight).toMatchObject({ kind: 'summary', flavorNote: FLAVOR_NOTE_BALANCED })
    expect(insight?.headline).toBe("You've logged 8 pours so far, averaging 8.0 — Working Fire.")
  })

  it('newer legacy pours without fip no longer crowd older tagged pours out of the window', () => {
    const pours = [
      ...Array.from({ length: 6 }, (_, i) => tagged(`t${i}`, 'a', 30 + i, 8, ['Vanilla', 'Caramel'])),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, bottleId: 'b', date: daysAgo(i), rating: 7.5 }) as unknown as Pour),
    ]
    const insight = getPalateInsight([bourbon, rye], pours)
    expect(insight?.kind).toBe('flavor')
    expect(insight?.headline).toBe('Sweet notes have come up in most of your last 5 tasted pours.')
  })

  it('a single pour still gets an honest summary instead of the empty state', () => {
    const insight = getPalateInsight([bourbon], [tagged('one', 'a', 1, 8, ['Oak'])])
    expect(insight).toMatchObject({ kind: 'summary', headline: "You've logged 1 pour so far, averaging 8.0 — Working Fire." })
    if (insight?.kind === 'summary') expect(insight.flavorNote).toBe(FLAVOR_NOTE_NEEDS_TAGS)
  })

  it('never counts an untasted bottle or crashes on a pour with a missing date', () => {
    const sealed: Bottle = { id: 's', name: 'Sealed', status: 'sealed', flavors: ['Smoke'], notes: 'peat and smoke', createdAt: 3 }
    const pours = [
      ...Array.from({ length: 3 }, (_, i) => tagged(`p${i}`, 'a', i, 8, ['Oak'])),
      { id: 'nodate', bottleId: 'a', rating: 8, fip: { ...minFip(8), palateFlavors: ['Oak'] } } as unknown as Pour,
    ]
    const insight = getPalateInsight([bourbon, sealed], pours)
    expect(insight?.kind).toBe('flavor')
    if (insight?.kind === 'flavor') expect(insight.primaryLabel).toBe('Oak-Forward')
  })
})

describe('getOpenBottles', () => {
  it('includes only open bottles, most recently opened first', () => {
    const bottles: Bottle[] = [
      { id: 'a', name: 'Older', status: 'open', createdAt: 1, openedDate: '2026-01-01' },
      { id: 'b', name: 'Newer', status: 'open', createdAt: 2, openedDate: '2026-06-01' },
      { id: 'c', name: 'Sealed', status: 'sealed', createdAt: 3 },
    ]
    const result = getOpenBottles(bottles, [])
    expect(result.map((r) => r.bottle.id)).toEqual(['b', 'a'])
  })

  it('carries fill level and last-poured facts for each open bottle', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Eagle Rare', status: 'open', createdAt: 1, fillLevel: 'half' }]
    const pours: Pour[] = [
      { id: 'p1', bottleId: 'a', date: daysAgo(5), rating: 8, fip: minFip(8) },
      { id: 'p2', bottleId: 'a', date: daysAgo(1), rating: 8.5, fip: minFip(8.5) },
    ]
    const [summary] = getOpenBottles(bottles, pours)
    expect(summary?.fillPercent).toBe(50)
    expect(summary?.lastPouredDate).toBe(daysAgo(1))
    expect(summary?.pourCount).toBe(2)
  })

  it('reports no last-poured date for an open bottle with no pours', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Never Poured', status: 'open', createdAt: 1 }]
    const [summary] = getOpenBottles(bottles, [])
    expect(summary?.lastPouredDate).toBeUndefined()
    expect(summary?.pourCount).toBe(0)
  })
})

describe('getCollectionSnapshot', () => {
  it('counts totals by status', () => {
    const bottles: Bottle[] = [
      { id: 'a', name: 'Open', status: 'open', createdAt: 1 },
      { id: 'b', name: 'Sealed', status: 'sealed', createdAt: 1 },
      { id: 'c', name: 'Wishlist', status: 'wishlist', createdAt: 1 },
    ]
    expect(getCollectionSnapshot(bottles)).toEqual({ total: 3, open: 1, sealed: 1, needingAttention: 0 })
  })

  it('flags open bottles that are empty or down to a quarter as needing attention', () => {
    const bottles: Bottle[] = [
      { id: 'a', name: 'Empty', status: 'open', createdAt: 1, fillLevel: 'empty' },
      { id: 'b', name: 'Quarter', status: 'open', createdAt: 1, fillLevel: 'quarter' },
      { id: 'c', name: 'Full', status: 'open', createdAt: 1, fillLevel: 'full' },
      { id: 'd', name: 'Sealed', status: 'sealed', createdAt: 1, fillLevel: 'empty' },
    ]
    expect(getCollectionSnapshot(bottles).needingAttention).toBe(2)
  })
})
