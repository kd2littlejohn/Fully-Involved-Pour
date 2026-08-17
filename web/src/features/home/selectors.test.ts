import { describe, expect, it } from 'vitest'
import { getMaybeTonightCandidates, getPalateInsight } from './selectors'
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
  it('returns undefined below the minimum pour count', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'A', status: 'open', createdAt: 1 }]
    const pours: Pour[] = [
      { id: 'p1', bottleId: 'a', date: daysAgo(1), rating: 8, fip: { ...minFip(8), palateFlavors: ['Oak'] } },
    ]
    expect(getPalateInsight(bottles, pours)).toBeUndefined()
  })

  it('surfaces the dominant flavor axis once one clearly leads recent pours', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'A', status: 'open', createdAt: 1 }]
    const pours: Pour[] = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      bottleId: 'a',
      date: daysAgo(i),
      rating: 8,
      fip: { ...minFip(8), palateFlavors: ['Oak'] },
    }))

    const insight = getPalateInsight(bottles, pours)

    expect(insight).toEqual({
      headline: 'Woody-forward notes have come up in most of your last 5 pours.',
      primaryLabel: 'Woody-Forward',
      primaryPercent: 100,
      secondaryLabel: 'All Other Profiles',
      secondaryPercent: 0,
    })
  })

  it('returns undefined when no single flavor axis clearly dominates', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'A', status: 'open', createdAt: 1 }]
    const pours: Pour[] = [
      { id: 'p1', bottleId: 'a', date: daysAgo(1), rating: 8, fip: { ...minFip(8), palateFlavors: ['Oak'] } },
      { id: 'p2', bottleId: 'a', date: daysAgo(2), rating: 8, fip: { ...minFip(8), palateFlavors: ['Cherry'] } },
      { id: 'p3', bottleId: 'a', date: daysAgo(3), rating: 8, fip: { ...minFip(8), noseAromas: ['Cinnamon'] } },
      { id: 'p4', bottleId: 'a', date: daysAgo(4), rating: 8, fip: { ...minFip(8), palateFlavors: ['Vanilla'] } },
      { id: 'p5', bottleId: 'a', date: daysAgo(5), rating: 8, fip: minFip(8) },
    ]
    expect(getPalateInsight(bottles, pours)).toBeUndefined()
  })
})
