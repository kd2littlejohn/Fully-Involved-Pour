import type { Bottle, Pour } from '../../data/types'
import type { PalateProfile } from '../yourPalate/palateProfile'
import { TOP_RATED_THRESHOLD, TOP_RATED_MIN_POURS, bucketForProof } from '../yourPalate/selectors'
import { flavorRadarValues, collectionFlavorRadarValues } from '../flavorRadar/flavorCategories'

export type PalateMatchConfidence = 'low' | 'medium' | 'high'
export type PalateMatchStatus = 'still-learning' | 'scored'

export interface PalateMatchResult {
  score: number | null // 0-100, always null when status is 'still-learning'
  confidence: PalateMatchConfidence
  status: PalateMatchStatus
  reasons: string[]
}

// Only a signal strong enough to genuinely explain "why it fits" earns a
// reason string — a weak/lukewarm signal still contributes to the score but
// doesn't get billed as a reason.
const REASON_THRESHOLD = 0.6

const STILL_LEARNING: PalateMatchResult = { score: null, confidence: 'low', status: 'still-learning', reasons: [] }

interface Signal {
  weight: number
  value: number // 0-1
  reason?: string
}

function normalizeRadar(values: number[]): number[] {
  const sum = values.reduce((s, v) => s + v, 0)
  if (sum === 0) return values.map(() => 0)
  return values.map((v) => v / sum)
}

// Total-variation-based similarity between two flavor radar distributions —
// 1 when identical, 0 when they share nothing. Normalizing first compares
// relative flavor *balance*, not raw magnitude (which would just reward
// whichever axis happens to be each bottle's own dominant one).
function radarSimilarity(a: number[], b: number[]): number {
  const na = normalizeRadar(a)
  const nb = normalizeRadar(b)
  const totalVariation = na.reduce((sum, v, i) => sum + Math.abs(v - (nb[i] ?? 0)), 0) / 2
  return Math.max(0, 1 - totalVariation)
}

// ~40% — does this bottle's own flavor profile resemble the blended flavor
// profile behind the user's highest-rated pours overall?
function flavorOverlapSignal(candidate: Bottle, bottles: Bottle[], pours: Pour[]): Signal | undefined {
  const highRated = pours.filter((p) => p.rating >= TOP_RATED_THRESHOLD)
  if (highRated.length < TOP_RATED_MIN_POURS) return undefined

  const relevantIds = new Set(highRated.map((p) => p.bottleId))
  const relevantBottles = bottles.filter((b) => relevantIds.has(b.id))
  const userRadar = collectionFlavorRadarValues(relevantBottles, highRated)
  const candidateRadar = flavorRadarValues(candidate, pours)
  if (!userRadar || !candidateRadar) return undefined

  const value = radarSimilarity(userRadar, candidateRadar)
  return {
    weight: 0.4,
    value,
    reason: value >= REASON_THRESHOLD ? 'Its flavor profile lines up with your highest-rated pours.' : undefined,
  }
}

// ~25% — only counts when the category is comparatively rating-supported
// (see getCategoryScores); "most poured" alone isn't evidence of a fit.
function categorySignal(candidate: Bottle, profile: PalateProfile): Signal | undefined {
  const type = candidate.type?.trim()
  if (!type) return undefined
  const match = profile.categoryScores.find((c) => c.category === type)
  if (!match || match.mode !== 'rating-supported' || match.averageRating == null) return undefined

  const value = match.averageRating / 10
  return {
    weight: 0.25,
    value,
    reason: value >= REASON_THRESHOLD ? `You've rated ${type} highly in the past.` : undefined,
  }
}

// ~20% — nearest-neighbor: is there a SPECIFIC bottle the user already rated
// highly that resembles this one? A distinct, complementary lens from the
// aggregate flavorOverlapSignal above (blended profile vs. single closest
// match), reusing the same radar/similarity helpers, no duplicate math.
function similarHighRatedSignal(candidate: Bottle, bottles: Bottle[], pours: Pour[]): Signal | undefined {
  const candidateRadar = flavorRadarValues(candidate, pours)
  if (!candidateRadar) return undefined

  const highRated = pours.filter((p) => p.rating >= TOP_RATED_THRESHOLD && p.bottleId !== candidate.id)
  if (highRated.length < TOP_RATED_MIN_POURS) return undefined

  const highRatedBottleIds = new Set(highRated.map((p) => p.bottleId))
  let best: { bottle: Bottle; similarity: number } | undefined
  for (const bottleId of highRatedBottleIds) {
    const bottle = bottles.find((b) => b.id === bottleId)
    if (!bottle) continue
    const radar = flavorRadarValues(bottle, pours)
    if (!radar) continue
    const similarity = radarSimilarity(candidateRadar, radar)
    if (!best || similarity > best.similarity) best = { bottle, similarity }
  }
  if (!best) return undefined

  return {
    weight: 0.2,
    value: best.similarity,
    reason: best.similarity >= REASON_THRESHOLD ? `Resembles ${best.bottle.name}, a bottle you've already rated highly.` : undefined,
  }
}

// ~15% — deliberately the smallest weight, and only counts when the
// candidate's own proof falls in the user's single known-affinity bucket
// (getProofAffinity only exposes the winning bucket's stats, not every
// bucket's) — a bottle outside that bucket is excluded here rather than
// penalized with a number we can't actually ground in real data.
function proofSignal(candidate: Bottle, profile: PalateProfile): Signal | undefined {
  if (typeof candidate.proof !== 'number' || !profile.proofAffinity) return undefined
  const bucket = bucketForProof(candidate.proof)
  if (bucket !== profile.proofAffinity.bucketLabel) return undefined

  const value = profile.proofAffinity.averageRating / 10
  return {
    weight: 0.15,
    value,
    reason: value >= REASON_THRESHOLD ? `Similar proof range (${bucket}) has performed well for you.` : undefined,
  }
}

// Deterministic 0-100 match score from whatever signals are actually
// available — never requires every signal, never fabricates one that isn't
// there. AI (see explainPalateMatch) only ever explains this number; it
// never computes it.
export function computePalateMatch(candidate: Bottle, bottles: Bottle[], pours: Pour[], profile: PalateProfile): PalateMatchResult {
  if (profile.maturity === 'learning') return STILL_LEARNING

  const signals = [
    flavorOverlapSignal(candidate, bottles, pours),
    categorySignal(candidate, profile),
    similarHighRatedSignal(candidate, bottles, pours),
    proofSignal(candidate, profile),
  ].filter((s): s is Signal => Boolean(s))

  if (signals.length === 0) return STILL_LEARNING

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0)
  const weightedSum = signals.reduce((sum, s) => sum + s.weight * s.value, 0)
  const score = Math.round((weightedSum / totalWeight) * 100)

  // Independent of the score itself — purely how many of the 4 possible
  // signals actually had usable data behind them.
  const confidence: PalateMatchConfidence = signals.length >= 3 ? 'high' : signals.length === 2 ? 'medium' : 'low'

  const reasons = [...signals]
    .sort((a, b) => b.value - a.value)
    .map((s) => s.reason)
    .filter((r): r is string => Boolean(r))

  return { score, confidence, status: 'scored', reasons }
}
