import { describe, expect, it } from 'vitest'
import type { Bottle, Pour } from '../../data/types'
import { isQualifyingPour, getPalateMaturity, getCategoryScores, buildPalateProfile } from './palateProfile'

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
const untyped: Bottle = { id: 'b5', name: 'Mystery Bottle', status: 'open' }

describe('isQualifyingPour', () => {
  it('does not qualify a bare rating with no tags or notes', () => {
    expect(isQualifyingPour(pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }))).toBe(false)
  })

  it('qualifies a pour with at least one structured nose tag', () => {
    const p = pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })
    p.fip.noseAromas = ['Vanilla']
    expect(isQualifyingPour(p)).toBe(true)
  })

  it('qualifies a pour with at least one structured palate tag', () => {
    const p = pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })
    p.fip.palateFlavors = ['Caramel']
    expect(isQualifyingPour(p)).toBe(true)
  })

  it('does not qualify a note shorter than the meaningful-length threshold', () => {
    const p = pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })
    p.fip.noseNotes = 'nice'
    expect(isQualifyingPour(p)).toBe(false)
  })

  it('qualifies a note at or above the meaningful-length threshold', () => {
    const p = pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })
    p.fip.palateNotes = 'Really rich caramel up front.'
    expect(isQualifyingPour(p)).toBe(true)
  })
})

describe('getPalateMaturity', () => {
  it.each([
    [0, 'learning'],
    [2, 'learning'],
    [3, 'taking-shape'],
    [7, 'taking-shape'],
    [8, 'developing'],
    [14, 'developing'],
    [15, 'established'],
    [40, 'established'],
  ] as const)('%i qualifying pours -> %s', (count, expected) => {
    expect(getPalateMaturity(count)).toBe(expected)
  })
})

describe('getCategoryScores', () => {
  it('returns an empty list when no pour has a typed bottle', () => {
    expect(getCategoryScores([untyped], [pour({ id: 'p1', bottleId: 'b5', date: daysAgo(1), rating: 8 })])).toEqual([])
  })

  it('falls back to frequency-only ranking when fewer than two categories are eligible', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 9 }),
      pour({ id: 'p3', bottleId: 'b3', date: daysAgo(3), rating: 7 }), // only 1 rye pour — not eligible
    ]
    const scores = getCategoryScores([bourbon, rye], pours)
    expect(scores).toHaveLength(2)
    expect(scores[0]).toMatchObject({ category: 'Bourbon', mode: 'frequency-only', pourCount: 2 })
  })

  it('ranks every eligible category by average rating once at least two clear the bar', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 7 }),
      pour({ id: 'p2', bottleId: 'b2', date: daysAgo(2), rating: 7 }), // bourbon, avg 7
      pour({ id: 'p3', bottleId: 'b3', date: daysAgo(3), rating: 9 }),
      pour({ id: 'p4', bottleId: 'b4', date: daysAgo(4), rating: 9 }), // rye, avg 9
    ]
    const scores = getCategoryScores([bourbon, bourbon2, rye, rye2], pours)
    expect(scores.map((s) => s.category)).toEqual(['Rye', 'Bourbon'])
    expect(scores[0]).toMatchObject({ mode: 'rating-supported', averageRating: 9 })
  })
})

describe('buildPalateProfile', () => {
  it('handles zero pours gracefully', () => {
    const profile = buildPalateProfile([], [])
    expect(profile).toEqual({
      qualifyingPourCount: 0,
      maturity: 'learning',
      categoryScores: [],
      proofAffinity: undefined,
      topRatedFlavors: [],
      loyalty: undefined,
      finishPreference: undefined,
      mouthfeelPreference: undefined,
    })
  })

  it('handles a single pour without inflating maturity or fabricating preferences', () => {
    const p = pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })
    p.fip.noseAromas = ['Vanilla']
    const profile = buildPalateProfile([bourbon], [p])
    expect(profile.qualifyingPourCount).toBe(1)
    expect(profile.maturity).toBe('learning')
    expect(profile.categoryScores).toEqual([{ category: 'Bourbon', mode: 'frequency-only', pourCount: 1 }])
  })

  it('does not let a run of casual, tag-less pours claim an Established palate', () => {
    const casualPours: Pour[] = Array.from({ length: 20 }, (_, i) => pour({ id: `p${i}`, bottleId: 'b1', date: daysAgo(i), rating: 8 }))
    const profile = buildPalateProfile([bourbon], casualPours)
    expect(profile.qualifyingPourCount).toBe(0)
    expect(profile.maturity).toBe('learning')
  })

  it('reaches Established once enough pours actually carry real tasting engagement', () => {
    const richPours: Pour[] = Array.from({ length: 15 }, (_, i) => {
      const p = pour({ id: `p${i}`, bottleId: 'b1', date: daysAgo(i), rating: 8 })
      p.fip.noseAromas = ['Vanilla']
      return p
    })
    const profile = buildPalateProfile([bourbon], richPours)
    expect(profile.qualifyingPourCount).toBe(15)
    expect(profile.maturity).toBe('established')
  })

  it('surfaces a proof affinity once comparatively supported, mirroring getProofAffinity', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 6 }), // 90 proof
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 6 }),
      pour({ id: 'p3', bottleId: 'b3', date: daysAgo(3), rating: 9 }), // 115 proof
      pour({ id: 'p4', bottleId: 'b3', date: daysAgo(4), rating: 9 }),
    ]
    const profile = buildPalateProfile([bourbon, rye], pours)
    expect(profile.proofAffinity?.bucketLabel).toBe('110+ proof')
  })

  it('surfaces top-rated flavor tags only once the threshold is met, reusing getTopRatedFlavorTags as-is', () => {
    const highRated: Pour[] = Array.from({ length: 3 }, (_, i) => {
      const p = pour({ id: `hr${i}`, bottleId: 'b1', date: daysAgo(i), rating: 9 })
      p.fip.palateFlavors = ['Caramel']
      return p
    })
    const profile = buildPalateProfile([bourbon], highRated)
    expect(profile.topRatedFlavors.map((t) => t.tag)).toContain('Caramel')
  })

  it('leaves finish and mouthfeel preference undefined — no structured data exists to derive them from yet', () => {
    const profile = buildPalateProfile([bourbon], [pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })])
    expect(profile.finishPreference).toBeUndefined()
    expect(profile.mouthfeelPreference).toBeUndefined()
  })

  it('handles conflicting category/proof signals without picking a false winner', () => {
    // Two categories, evenly tied on rating — getCategoryScores should still
    // return both, ranked deterministically, not silently drop one.
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8 }),
      pour({ id: 'p3', bottleId: 'b3', date: daysAgo(3), rating: 8 }),
      pour({ id: 'p4', bottleId: 'b3', date: daysAgo(4), rating: 8 }),
    ]
    const profile = buildPalateProfile([bourbon, rye], pours)
    expect(profile.categoryScores).toHaveLength(2)
    expect(profile.categoryScores.every((s) => s.averageRating === 8)).toBe(true)
  })

  it('handles bottles with missing type/proof metadata without throwing', () => {
    const profile = buildPalateProfile([untyped], [pour({ id: 'p1', bottleId: 'b5', date: daysAgo(1), rating: 8 })])
    expect(profile.categoryScores).toEqual([])
    expect(profile.proofAffinity).toBeUndefined()
  })
})
