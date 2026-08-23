import { describe, expect, it } from 'vitest'
import type { Bottle, Pour } from '../../data/types'
import { buildPalateProfile } from '../yourPalate/palateProfile'
import { computePalateMatch } from './scoring'

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return {
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

const eagleRare: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', type: 'Bourbon', proof: 90 }
const weller: Bottle = { id: 'b2', name: 'Weller 12', status: 'open', type: 'Bourbon', proof: 95 }
const ryeX: Bottle = { id: 'b3', name: 'Rye X', status: 'open', type: 'Rye', proof: 110 }

// A real, established palate: sweet/vanilla-leaning Bourbon drinker, with a
// clear "90–100 proof" affinity and Rye tried but rated meaningfully lower —
// exercised through the real buildPalateProfile, not a hand-rolled mock, so
// this also verifies the Phase 2 -> Phase 5 handoff end-to-end.
const establishedPours: Pour[] = [
  pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 9.0 }),
  pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8.5 }),
  pour({ id: 'p3', bottleId: 'b2', date: daysAgo(3), rating: 8.8 }),
  pour({ id: 'p4', bottleId: 'b2', date: daysAgo(4), rating: 8.2 }),
  pour({ id: 'p5', bottleId: 'b3', date: daysAgo(5), rating: 6.0 }),
  pour({ id: 'p6', bottleId: 'b3', date: daysAgo(6), rating: 5.8 }),
]
establishedPours[0]!.fip.palateFlavors = ['Vanilla', 'Caramel']
establishedPours[1]!.fip.palateFlavors = ['Vanilla']
establishedPours[2]!.fip.palateFlavors = ['Caramel']
establishedPours[3]!.fip.palateFlavors = ['Vanilla']

const establishedBottles = [eagleRare, weller, ryeX]
const establishedProfile = buildPalateProfile(establishedBottles, establishedPours)

describe('computePalateMatch', () => {
  it('never scores below the maturity floor, regardless of how well the bottle would otherwise match', () => {
    const learningProfile = buildPalateProfile(establishedBottles, establishedPours.slice(0, 1))
    const candidate: Bottle = { id: 'new', name: 'New Bourbon', status: 'wishlist', type: 'Bourbon', proof: 92, flavors: ['Vanilla', 'Caramel'] }

    const result = computePalateMatch(candidate, establishedBottles, establishedPours.slice(0, 1), learningProfile)

    expect(result).toEqual({ score: null, confidence: 'low', status: 'still-learning', reasons: [] })
  })

  it('returns still-learning when no signal has any usable data, even past the maturity floor', () => {
    const candidate: Bottle = { id: 'blank', name: 'Blank Slate', status: 'wishlist' }

    const result = computePalateMatch(candidate, establishedBottles, establishedPours, establishedProfile)

    expect(result.status).toBe('still-learning')
    expect(result.score).toBeNull()
  })

  it('produces a high score with high confidence when every signal points the same strong direction', () => {
    const candidate: Bottle = { id: 'new', name: 'New Bourbon', status: 'wishlist', type: 'Bourbon', proof: 92, flavors: ['Vanilla', 'Caramel'] }

    const result = computePalateMatch(candidate, establishedBottles, establishedPours, establishedProfile)

    expect(result.status).toBe('scored')
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.confidence).toBe('high')
    expect(result.reasons).toContain('Its flavor profile lines up with your highest-rated pours.')
    expect(result.reasons).toContain("You've rated Bourbon highly in the past.")
    expect(result.reasons.some((r) => r.startsWith('Resembles'))).toBe(true)
    expect(result.reasons.some((r) => r.includes('proof range'))).toBe(true)
  })

  it('produces a low score with HIGH confidence when several signals agree it is a poor fit — confidence tracks data completeness, not score', () => {
    const candidate: Bottle = { id: 'new', name: 'Smoky Rye', status: 'wishlist', type: 'Rye', proof: 200, flavors: ['Leather'] }

    const result = computePalateMatch(candidate, establishedBottles, establishedPours, establishedProfile)

    expect(result.status).toBe('scored')
    expect(result.score).toBeLessThan(30)
    expect(result.confidence).toBe('high')
    expect(result.reasons).toEqual([])
  })

  it('produces a high score with LOW confidence from a single strong signal — again, confidence tracks completeness, not score', () => {
    // Only the category is known; no proof, no flavor tags, no pours of its
    // own — flavor and similar-bottle signals have nothing to compare.
    const candidate: Bottle = { id: 'new', name: 'Mystery Bourbon', status: 'wishlist', type: 'Bourbon' }

    const result = computePalateMatch(candidate, establishedBottles, establishedPours, establishedProfile)

    expect(result.status).toBe('scored')
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.confidence).toBe('low')
    expect(result.reasons).toEqual(["You've rated Bourbon highly in the past."])
  })

  it('reaches medium confidence at exactly two usable signals', () => {
    // Category + proof both known; no flavor tags of its own to compare.
    const candidate: Bottle = { id: 'new', name: 'Unlabeled Bourbon', status: 'wishlist', type: 'Bourbon', proof: 92 }

    const result = computePalateMatch(candidate, establishedBottles, establishedPours, establishedProfile)

    expect(result.status).toBe('scored')
    expect(result.confidence).toBe('medium')
  })

  it('excludes the proof signal entirely (not as a penalty) when the candidate has no proof, rather than guessing', () => {
    const withProof: Bottle = { id: 'a', name: 'A', status: 'wishlist', type: 'Bourbon', proof: 92, flavors: ['Vanilla'] }
    const withoutProof: Bottle = { id: 'b', name: 'B', status: 'wishlist', type: 'Bourbon', flavors: ['Vanilla'] }

    const withProofResult = computePalateMatch(withProof, establishedBottles, establishedPours, establishedProfile)
    const withoutProofResult = computePalateMatch(withoutProof, establishedBottles, establishedPours, establishedProfile)

    expect(withProofResult.confidence).toBe('high') // 4 signals
    expect(withoutProofResult.confidence).toBe('high') // still 3 signals (category, flavor, similar-pour) — the threshold for 'high'
    expect(withoutProofResult.reasons.some((r) => r.includes('proof range'))).toBe(false)
  })

  it('excludes a candidate\'s own pours from the similar-highly-rated comparison set, avoiding a self-referential match', () => {
    // Eagle Rare itself already has two high-rated pours in the fixture —
    // computing its own match should not cite itself as "similar to Eagle Rare."
    const result = computePalateMatch(eagleRare, establishedBottles, establishedPours, establishedProfile)

    expect(result.reasons.some((r) => r.includes('Resembles Eagle Rare'))).toBe(false)
  })

  it('gives an unknown/never-tried category no rating-supported boost, since frequency alone is not preference', () => {
    // Only one Rye pour ever logged at all would leave Rye ineligible for
    // rating-supported comparison — reflected here via a profile built from
    // just the Bourbon history, where Rye never appears in categoryScores.
    const bourbonOnlyProfile = buildPalateProfile([eagleRare, weller], establishedPours.filter((p) => p.bottleId !== 'b3'))
    const candidate: Bottle = { id: 'new', name: 'Untried Rye', status: 'wishlist', type: 'Rye', proof: 110 }

    const result = computePalateMatch(candidate, [eagleRare, weller], establishedPours.filter((p) => p.bottleId !== 'b3'), bourbonOnlyProfile)

    // Category signal excluded entirely — no data to support or refute Rye.
    expect(result.reasons.some((r) => r.includes('Rye'))).toBe(false)
  })
})
