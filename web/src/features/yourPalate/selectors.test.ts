import { describe, expect, it } from 'vitest'
import type { Bottle, Pour } from '../../data/types'
import {
  getPalateStats,
  getBuyAgainRate,
  getLoyaltySignal,
  getCategoryAffinity,
  getProofAffinity,
  getTopOccasion,
  getPalateEvolution,
} from './selectors'

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return {
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

const bourbon: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', type: 'Bourbon', proof: 90 }
const bourbon2: Bottle = { id: 'b2', name: 'Weller', status: 'open', type: 'Bourbon', proof: 95 }
const rye: Bottle = { id: 'b3', name: 'Michters Rye', status: 'open', type: 'Rye', proof: 115 }
const rye2: Bottle = { id: 'b4', name: 'Whistlepig', status: 'open', type: 'Rye', proof: 120 }

describe('getPalateStats', () => {
  it('returns undefined for 0 pours', () => {
    expect(getPalateStats([])).toBeUndefined()
  })

  it('computes correct averages for 1 pour', () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8.4 })]
    const stats = getPalateStats(pours)
    expect(stats).toEqual({
      pourCount: 1,
      averageScore: 8.4,
      // round1 rounds half-up to 1 decimal, so 0.75 -> 0.8 (matches
      // Math.round's own convention, not a selector bug).
      averageComponents: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 0.8 },
    })
  })

  it('computes correct averages for exactly 3 pours', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 6 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8 }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 10 }),
    ]
    const stats = getPalateStats(pours)
    expect(stats?.pourCount).toBe(3)
    expect(stats?.averageScore).toBe(8)
  })
})

describe('getBuyAgainRate', () => {
  it('returns undefined when buyAgain is absent on every pour', () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })]
    expect(getBuyAgainRate(pours)).toBeUndefined()
  })

  it('averages only the pours that logged a value, ignoring ones that did not', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8, buyAgain: 'absolutely' }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8, buyAgain: 'no' }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 8 }), // no buyAgain — excluded
    ]
    const stat = getBuyAgainRate(pours)
    expect(stat?.consideredCount).toBe(2)
    expect(stat?.rate).toBe(0.5) // (1 + 0) / 2
  })
})

describe('getLoyaltySignal', () => {
  it('returns undefined for 0 pours', () => {
    expect(getLoyaltySignal([bourbon], [])).toBeUndefined()
  })

  it('identifies a repeatedly-poured bottle', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 9 }),
      pour({ id: 'p3', bottleId: 'b2', date: daysAgo(3), rating: 7 }),
    ]
    const stat = getLoyaltySignal([bourbon, bourbon2], pours)
    expect(stat?.pouredBottleCount).toBe(2)
    expect(stat?.repeatBottleCount).toBe(1)
    expect(stat?.mostRepeated?.bottle.id).toBe('b1')
    expect(stat?.mostRepeated?.pourCount).toBe(2)
  })

  it('handles a pour referencing a bottle that no longer exists in the collection', () => {
    const pours = [pour({ id: 'p1', bottleId: 'missing-bottle', date: daysAgo(1), rating: 8 })]
    const stat = getLoyaltySignal([bourbon], pours)
    expect(stat?.pouredBottleCount).toBe(1)
    expect(stat?.mostRepeated).toBeUndefined()
  })

  it('omits mostRepeated when no bottle has been poured more than once', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 8 }),
    ]
    const stat = getLoyaltySignal([bourbon, bourbon2], pours)
    expect(stat?.mostRepeated).toBeUndefined()
  })
})

describe('getCategoryAffinity', () => {
  it('returns undefined when no pour has a bottle with a known type', () => {
    const untyped: Bottle = { id: 'b9', name: 'Mystery', status: 'open' }
    const pours = [pour({ id: 'p1', bottleId: 'b9', date: daysAgo(1), rating: 8 })]
    expect(getCategoryAffinity([untyped], pours)).toBeUndefined()
  })

  it('falls back to honest frequency-only labeling when all pours are the same category', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 6 }),
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 9 }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 7 }),
    ]
    const affinity = getCategoryAffinity([bourbon, bourbon2], pours)
    expect(affinity?.mode).toBe('frequency-only')
    expect(affinity?.category).toBe('Bourbon')
    expect(affinity?.averageRating).toBeUndefined()
  })

  it('prefers the rating-supported category once two categories each have 2+ pours', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 6 }), // Bourbon
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 6.5 }), // Bourbon
      pour({ id: 'p3', bottleId: 'b3', date: daysAgo(3), rating: 9.5 }), // Rye
      pour({ id: 'p4', bottleId: 'b4', date: daysAgo(4), rating: 9.0 }), // Rye
    ]
    const affinity = getCategoryAffinity([bourbon, bourbon2, rye, rye2], pours)
    expect(affinity?.mode).toBe('rating-supported')
    expect(affinity?.category).toBe('Rye')
    expect(affinity?.averageRating).toBe(9.3) // (9.5 + 9.0) / 2, rounded
  })

  it('does not use rating-supported mode when a category only has 1 pour', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 6 }), // Bourbon x2
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 6.5 }), // Bourbon
      pour({ id: 'p3', bottleId: 'b3', date: daysAgo(3), rating: 9.5 }), // Rye x1 only
    ]
    const affinity = getCategoryAffinity([bourbon, bourbon2, rye], pours)
    expect(affinity?.mode).toBe('frequency-only')
    expect(affinity?.category).toBe('Bourbon')
  })
})

describe('getProofAffinity', () => {
  it('returns undefined when proof buckets are insufficient', () => {
    // Only one bucket (90-100 proof) has any pours at all.
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 9 }),
    ]
    expect(getProofAffinity([bourbon, bourbon2], pours)).toBeUndefined()
  })

  it('returns undefined when a second bucket exists but has fewer than 2 pours', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }), // 90-100
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 9 }), // 90-100
      pour({ id: 'p3', bottleId: 'b3', date: daysAgo(3), rating: 9.5 }), // 110+  (only 1 pour)
    ]
    expect(getProofAffinity([bourbon, bourbon2, rye], pours)).toBeUndefined()
  })

  it('returns the highest-rated bucket once proof buckets are sufficiently supported', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 6 }), // 90-100
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 6.5 }), // 90-100
      pour({ id: 'p3', bottleId: 'b3', date: daysAgo(3), rating: 9.5 }), // 110+
      pour({ id: 'p4', bottleId: 'b4', date: daysAgo(4), rating: 9.0 }), // 110+
    ]
    const affinity = getProofAffinity([bourbon, bourbon2, rye, rye2], pours)
    expect(affinity?.bucketLabel).toBe('110+ proof')
    expect(affinity?.averageRating).toBe(9.3)
    expect(affinity?.pourCount).toBe(2)
  })

  it('ignores pours whose bottle has no proof recorded (missing optional data)', () => {
    const noProof: Bottle = { id: 'b9', name: 'Unknown Proof', status: 'open' }
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 9 }),
      pour({ id: 'p3', bottleId: 'b9', date: daysAgo(3), rating: 10 }),
    ]
    // b9 has no proof, so it can't form a second bucket — still insufficient.
    expect(getProofAffinity([bourbon, bourbon2, noProof], pours)).toBeUndefined()
  })
})

describe('getTopOccasion', () => {
  it('returns undefined when no pour has an occasion set', () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })]
    expect(getTopOccasion(pours)).toBeUndefined()
  })

  it('returns undefined when every occasion is a one-off (not meaningfully common)', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8, occasion: 'Birthday' }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8, occasion: 'Anniversary' }),
    ]
    expect(getTopOccasion(pours)).toBeUndefined()
  })

  it('surfaces an occasion that repeats, case/whitespace-insensitively', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8, occasion: 'Quiet evening' }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8, occasion: '  quiet evening  ' }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 8, occasion: 'Celebration' }),
    ]
    const top = getTopOccasion(pours)
    expect(top?.occasion).toBe('Quiet evening')
    expect(top?.count).toBe(2)
  })
})

describe('getPalateEvolution', () => {
  it('returns undefined below the 6-pour minimum', () => {
    const pours = Array.from({ length: 5 }, (_, i) => pour({ id: `p${i}`, bottleId: 'b1', date: daysAgo(10 - i), rating: 7 }))
    expect(getPalateEvolution(pours)).toBeUndefined()
  })

  it('reports steady when the change is below the noise threshold', () => {
    const ratings = [8.0, 8.0, 8.0, 8.1, 8.2, 8.1] // oldest 3 avg 8.0, newest 3 avg 8.13 -> delta 0.1
    const pours = ratings.map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: daysAgo(10 - i), rating }))
    const evolution = getPalateEvolution(pours)
    expect(evolution?.kind).toBe('steady')
  })

  it('reports meaningful improvement once 6+ pours show a real upward shift', () => {
    const ratings = [6.0, 6.2, 6.1, 8.5, 8.7, 8.6] // oldest 3 avg ~6.1, newest 3 avg ~8.6
    const pours = ratings.map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: daysAgo(10 - i), rating }))
    const evolution = getPalateEvolution(pours)
    expect(evolution?.kind).toBe('improved')
    expect(evolution!.newAverage).toBeGreaterThan(evolution!.oldAverage)
  })

  it('reports meaningful decline once 6+ pours show a real downward shift', () => {
    const ratings = [9.0, 8.8, 8.9, 6.0, 6.1, 6.2]
    const pours = ratings.map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: daysAgo(10 - i), rating }))
    const evolution = getPalateEvolution(pours)
    expect(evolution?.kind).toBe('declined')
    expect(evolution!.newAverage).toBeLessThan(evolution!.oldAverage)
  })

  it('is order-independent — sorts by date rather than trusting array order', () => {
    const ratings = [6.0, 6.2, 6.1, 8.5, 8.7, 8.6]
    const pours = ratings.map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: daysAgo(10 - i), rating }))
    const shuffled = [...pours].reverse()
    expect(getPalateEvolution(shuffled)).toEqual(getPalateEvolution(pours))
  })
})
