import type { Bottle, Pour } from '../../data/types'
import type { FlavorTagRank } from '../flavorRadar/flavorCategories'
import {
  getProofAffinity,
  getTopRatedFlavorTags,
  getLoyaltySignal,
  MIN_BUCKETS_FOR_COMPARISON,
  MIN_POURS_PER_BUCKET,
  round1,
  type ProofAffinity,
  type LoyaltyStat,
} from './selectors'

// ---------------------------------------------------------------------------
// Qualifying pours — a pour only teaches FIP something about taste once it
// carries real tasting engagement, not just a bare numeric rating. Prevents
// a run of quick, tag-less ratings from inflating palate maturity toward
// "Established."
// ---------------------------------------------------------------------------

const MIN_QUALIFYING_NOTE_LENGTH = 10

export function isQualifyingPour(pour: Pour): boolean {
  if (pour.fip.noseAromas.length > 0 || pour.fip.palateFlavors.length > 0) return true
  const notes = [pour.fip.noseNotes, pour.fip.palateNotes, pour.fip.finishNotes, pour.fip.complexityNotes]
  return notes.some((note) => (note?.trim().length ?? 0) >= MIN_QUALIFYING_NOTE_LENGTH)
}

// ---------------------------------------------------------------------------
// Maturity ladder — runs against qualifying pours only, never raw pour count.
// Thresholds are intentionally simple constants so they're easy to tune.
// ---------------------------------------------------------------------------

export type PalateMaturity = 'learning' | 'taking-shape' | 'developing' | 'established'

const MATURITY_LADDER: { maxQualifyingPours: number; maturity: PalateMaturity }[] = [
  { maxQualifyingPours: 2, maturity: 'learning' },
  { maxQualifyingPours: 7, maturity: 'taking-shape' },
  { maxQualifyingPours: 14, maturity: 'developing' },
]

export function getPalateMaturity(qualifyingPourCount: number): PalateMaturity {
  const rung = MATURITY_LADDER.find((r) => qualifyingPourCount <= r.maxQualifyingPours)
  return rung?.maturity ?? 'established'
}

// ---------------------------------------------------------------------------
// Category scores — the same eligibility rule as selectors.ts's
// getCategoryAffinity (>=2 pours per category, rating-supported ranking only
// once >=2 categories clear that bar), but returns every eligible category
// ranked instead of just the single best one.
// ---------------------------------------------------------------------------

export interface CategoryScore {
  category: string
  mode: 'rating-supported' | 'frequency-only'
  pourCount: number
  averageRating?: number
}

export function getCategoryScores(bottles: Bottle[], pours: Pour[]): CategoryScore[] {
  const byCategory = new Map<string, { count: number; ratingSum: number }>()
  for (const pour of pours) {
    const type = bottles.find((b) => b.id === pour.bottleId)?.type?.trim()
    if (!type) continue
    const entry = byCategory.get(type) ?? { count: 0, ratingSum: 0 }
    entry.count += 1
    entry.ratingSum += pour.rating
    byCategory.set(type, entry)
  }
  if (byCategory.size === 0) return []

  const eligible = [...byCategory.entries()].filter(([, v]) => v.count >= MIN_POURS_PER_BUCKET)
  if (eligible.length >= MIN_BUCKETS_FOR_COMPARISON) {
    return eligible
      .map(([category, stats]) => ({
        category,
        mode: 'rating-supported' as const,
        pourCount: stats.count,
        averageRating: round1(stats.ratingSum / stats.count),
      }))
      .sort((a, b) => b.averageRating - a.averageRating)
  }

  return [...byCategory.entries()]
    .map(([category, stats]) => ({ category, mode: 'frequency-only' as const, pourCount: stats.count }))
    .sort((a, b) => b.pourCount - a.pourCount)
}

// ---------------------------------------------------------------------------
// Palate Profile — the single typed object AI interpretation (Phase 4),
// smarter recommendations (Phase 6), and Palate Match (Phase 5) will all
// read from, instead of each re-deriving their own view of the user's
// history. Every field here is composed from the already-tested selectors
// above and in selectors.ts — no math is re-derived.
// ---------------------------------------------------------------------------

export interface PalateProfile {
  qualifyingPourCount: number
  maturity: PalateMaturity
  categoryScores: CategoryScore[]
  proofAffinity?: ProofAffinity
  topRatedFlavors: FlavorTagRank[]
  loyalty?: LoyaltyStat
  // No structured finish-length or mouthfeel data exists on Pour yet (only a
  // numeric fip.finish score + free-text finishNotes) — deliberately left
  // undefined rather than guessed at, until that data actually exists.
  finishPreference: string | undefined
  mouthfeelPreference: string | undefined
}

export function buildPalateProfile(bottles: Bottle[], pours: Pour[]): PalateProfile {
  const qualifyingPourCount = pours.filter(isQualifyingPour).length
  return {
    qualifyingPourCount,
    maturity: getPalateMaturity(qualifyingPourCount),
    categoryScores: getCategoryScores(bottles, pours),
    proofAffinity: getProofAffinity(bottles, pours),
    topRatedFlavors: getTopRatedFlavorTags(bottles, pours),
    loyalty: getLoyaltySignal(bottles, pours),
    finishPreference: undefined,
    mouthfeelPreference: undefined,
  }
}
