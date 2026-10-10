import type { Bottle, Pour } from '../../data/types'
import { buyAgainToValueScore } from '../fip/scoring'
import { pourFlavorLabels } from '../flavorRadar/flavorCategories'

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ---------------------------------------------------------------------------
// Overall averages
// ---------------------------------------------------------------------------

export interface PalateStats {
  pourCount: number
  averageScore: number
  averageComponents: { nose: number; palate: number; finish: number; complexity: number; value: number }
}

// Always safe to compute — pure averages, no preference claim, honest at any
// pour count (the caller decides how much surrounding language to add).
export function getPalateStats(pours: Pour[]): PalateStats | undefined {
  if (pours.length === 0) return undefined
  const n = pours.length
  const sum = (pick: (p: Pour) => number) => pours.reduce((s, p) => s + pick(p), 0)
  return {
    pourCount: n,
    averageScore: round1(sum((p) => p.rating) / n),
    averageComponents: {
      nose: round1(sum((p) => p.fip.nose) / n),
      palate: round1(sum((p) => p.fip.palate) / n),
      finish: round1(sum((p) => p.fip.finish) / n),
      complexity: round1(sum((p) => p.fip.complexity) / n),
      value: round1(sum((p) => p.fip.value) / n),
    },
  }
}

// ---------------------------------------------------------------------------
// Buy-again rate
// ---------------------------------------------------------------------------

export interface BuyAgainStat {
  rate: number // 0-1, average buyAgainToValueScore across pours that logged one
  consideredCount: number
}

export function getBuyAgainRate(pours: Pour[]): BuyAgainStat | undefined {
  const withValue = pours.filter((p) => p.buyAgain)
  if (withValue.length === 0) return undefined
  const avg = withValue.reduce((s, p) => s + buyAgainToValueScore(p.buyAgain), 0) / withValue.length
  return { rate: avg, consideredCount: withValue.length }
}

// ---------------------------------------------------------------------------
// Repeat-pour / loyalty signal
// ---------------------------------------------------------------------------

export interface LoyaltyStat {
  pouredBottleCount: number
  repeatBottleCount: number
  rate: number
  mostRepeated?: { bottle: Bottle; pourCount: number }
}

export function getLoyaltySignal(bottles: Bottle[], pours: Pour[]): LoyaltyStat | undefined {
  if (pours.length === 0) return undefined
  const countsByBottleId = new Map<string, number>()
  for (const pour of pours) {
    countsByBottleId.set(pour.bottleId, (countsByBottleId.get(pour.bottleId) ?? 0) + 1)
  }
  const pouredBottleCount = countsByBottleId.size
  if (pouredBottleCount === 0) return undefined
  const repeatBottleCount = [...countsByBottleId.values()].filter((c) => c > 1).length

  let bestId: string | undefined
  let bestCount = 0
  for (const [bottleId, count] of countsByBottleId) {
    if (count > bestCount) {
      bestCount = count
      bestId = bottleId
    }
  }
  const bestBottle = bestId ? bottles.find((b) => b.id === bestId) : undefined
  const mostRepeated = bestBottle && bestCount > 1 ? { bottle: bestBottle, pourCount: bestCount } : undefined

  return { pouredBottleCount, repeatBottleCount, rate: repeatBottleCount / pouredBottleCount, mostRepeated }
}

// ---------------------------------------------------------------------------
// Category/type affinity — frequency does not automatically equal preference
// ---------------------------------------------------------------------------

// Exported for reuse by palateProfile.ts's getCategoryScores, which applies
// this exact same eligibility rule but returns every eligible category
// ranked instead of just the single best one.
export const MIN_BUCKETS_FOR_COMPARISON = 2
export const MIN_POURS_PER_BUCKET = 2

export interface CategoryAffinity {
  mode: 'rating-supported' | 'frequency-only'
  category: string
  pourCount: number
  averageRating?: number
}

export function getCategoryAffinity(bottles: Bottle[], pours: Pour[]): CategoryAffinity | undefined {
  const byCategory = new Map<string, { count: number; ratingSum: number }>()
  for (const pour of pours) {
    const type = bottles.find((b) => b.id === pour.bottleId)?.type?.trim()
    if (!type) continue
    const entry = byCategory.get(type) ?? { count: 0, ratingSum: 0 }
    entry.count += 1
    entry.ratingSum += pour.rating
    byCategory.set(type, entry)
  }
  if (byCategory.size === 0) return undefined

  const eligible = [...byCategory.entries()].filter(([, v]) => v.count >= MIN_POURS_PER_BUCKET)
  if (eligible.length >= MIN_BUCKETS_FOR_COMPARISON) {
    const [category, stats] = eligible.reduce((best, cur) =>
      cur[1].ratingSum / cur[1].count > best[1].ratingSum / best[1].count ? cur : best,
    )
    return { mode: 'rating-supported', category, pourCount: stats.count, averageRating: round1(stats.ratingSum / stats.count) }
  }

  const [category, stats] = [...byCategory.entries()].reduce((best, cur) => (cur[1].count > best[1].count ? cur : best))
  return { mode: 'frequency-only', category, pourCount: stats.count }
}

// ---------------------------------------------------------------------------
// Proof affinity — only shown when comparatively supported (no frequency
// fallback: "most poured proof" isn't a meaningful enough fact on its own)
// ---------------------------------------------------------------------------

const PROOF_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: 'Under 90 proof', min: -Infinity, max: 90 },
  { label: '90–100 proof', min: 90, max: 100 },
  { label: '100–110 proof', min: 100, max: 110 },
  { label: '110+ proof', min: 110, max: Infinity },
]

// Exported for reuse by palateMatch/scoring.ts, which needs to know which
// bucket a *candidate* bottle's proof falls into, not just the user's own
// winning bucket.
export function bucketForProof(proof: number): string {
  return PROOF_BUCKETS.find((b) => proof >= b.min && proof < b.max)?.label ?? PROOF_BUCKETS[PROOF_BUCKETS.length - 1]!.label
}

export interface ProofAffinity {
  bucketLabel: string
  averageRating: number
  pourCount: number
}

export function getProofAffinity(bottles: Bottle[], pours: Pour[]): ProofAffinity | undefined {
  const byBucket = new Map<string, { count: number; ratingSum: number }>()
  for (const pour of pours) {
    const proof = bottles.find((b) => b.id === pour.bottleId)?.proof
    if (typeof proof !== 'number') continue
    const bucket = bucketForProof(proof)
    const entry = byBucket.get(bucket) ?? { count: 0, ratingSum: 0 }
    entry.count += 1
    entry.ratingSum += pour.rating
    byBucket.set(bucket, entry)
  }

  const eligible = [...byBucket.entries()].filter(([, v]) => v.count >= MIN_POURS_PER_BUCKET)
  if (eligible.length < MIN_BUCKETS_FOR_COMPARISON) return undefined

  const [bucketLabel, stats] = eligible.reduce((best, cur) =>
    cur[1].ratingSum / cur[1].count > best[1].ratingSum / best[1].count ? cur : best,
  )
  return { bucketLabel, averageRating: round1(stats.ratingSum / stats.count), pourCount: stats.count }
}

// ---------------------------------------------------------------------------
// Most common occasion — verbatim, no invented taxonomy
// ---------------------------------------------------------------------------

const MIN_OCCASION_COUNT = 2

export interface OccasionStat {
  occasion: string
  count: number
}

export function getTopOccasion(pours: Pour[]): OccasionStat | undefined {
  const counts = new Map<string, { display: string; count: number }>()
  for (const pour of pours) {
    const occasion = pour.occasion?.trim()
    if (!occasion) continue
    const key = occasion.toLowerCase()
    const entry = counts.get(key) ?? { display: occasion, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }
  if (counts.size === 0) return undefined
  const best = [...counts.values()].sort((a, b) => b.count - a.count)[0]
  if (!best || best.count < MIN_OCCASION_COUNT) return undefined
  return { occasion: best.display, count: best.count }
}

// ---------------------------------------------------------------------------
// Palate evolution — oldest 3 vs newest 3, only past a minimum total, never
// forced when the change is noise
// ---------------------------------------------------------------------------

const EVOLUTION_MIN_TOTAL_POURS = 6
const EVOLUTION_SAMPLE_SIZE = 3
const EVOLUTION_NOISE_THRESHOLD = 0.5 // FIP points

export interface EvolutionInsight {
  kind: 'improved' | 'declined' | 'steady'
  oldAverage: number
  newAverage: number
  delta: number
}

export function getPalateEvolution(pours: Pour[]): EvolutionInsight | undefined {
  if (pours.length < EVOLUTION_MIN_TOTAL_POURS) return undefined
  const sorted = [...pours].sort((a, b) => a.date.localeCompare(b.date))
  const oldest = sorted.slice(0, EVOLUTION_SAMPLE_SIZE)
  const newest = sorted.slice(-EVOLUTION_SAMPLE_SIZE)
  const oldAverage = round1(oldest.reduce((s, p) => s + p.rating, 0) / oldest.length)
  const newAverage = round1(newest.reduce((s, p) => s + p.rating, 0) / newest.length)
  const delta = round1(newAverage - oldAverage)
  const kind = Math.abs(delta) < EVOLUTION_NOISE_THRESHOLD ? 'steady' : delta > 0 ? 'improved' : 'declined'
  return { kind, oldAverage, newAverage, delta }
}

// ---------------------------------------------------------------------------
// Proof evolution — same oldest-N vs newest-N shape as score evolution, but
// tracking the proof of the bottles behind those pours instead of the score.
// ---------------------------------------------------------------------------

const PROOF_NOISE_THRESHOLD = 3 // proof points

export interface ProofEvolutionInsight {
  kind: 'higher' | 'lower' | 'steady'
  oldAverage: number
  newAverage: number
  delta: number
}

export function getProofEvolution(bottles: Bottle[], pours: Pour[]): ProofEvolutionInsight | undefined {
  const withProof = pours
    .map((p) => ({ date: p.date, proof: bottles.find((b) => b.id === p.bottleId)?.proof }))
    .filter((x): x is { date: string; proof: number } => typeof x.proof === 'number')
  if (withProof.length < EVOLUTION_MIN_TOTAL_POURS) return undefined

  const sorted = [...withProof].sort((a, b) => a.date.localeCompare(b.date))
  const oldest = sorted.slice(0, EVOLUTION_SAMPLE_SIZE)
  const newest = sorted.slice(-EVOLUTION_SAMPLE_SIZE)
  const oldAverage = round1(oldest.reduce((s, x) => s + x.proof, 0) / oldest.length)
  const newAverage = round1(newest.reduce((s, x) => s + x.proof, 0) / newest.length)
  const delta = round1(newAverage - oldAverage)
  const kind = Math.abs(delta) < PROOF_NOISE_THRESHOLD ? 'steady' : delta > 0 ? 'higher' : 'lower'
  return { kind, oldAverage, newAverage, delta }
}

// ---------------------------------------------------------------------------
// Flavor notes behind the highest-rated pours — a distinct measurement from
// the overall "experienced" tags (which cover every pour regardless of how
// it was rated): this is FIP's "flavors preferred" signal, so it must never
// be allowed to reflect just one well-loved bottle poured many times.
// ---------------------------------------------------------------------------

// Exported for reuse by palateMatch/scoring.ts, which applies this exact
// same "high-rated" definition when comparing a candidate bottle against the
// user's own best pours.
export const TOP_RATED_THRESHOLD = 8.0 // Working Fire and above, see features/fip/tiers.ts
export const TOP_RATED_MIN_POURS = 3
// A flavor only counts as "preferred" once it shows up across at least this
// many *different* high-rated bottles — otherwise 3 repeat pours of a
// single favorite bottle would look identical to 3 different well-rated
// bottles that happen to share a note, which is a much stronger signal.
export const TOP_RATED_MIN_BOTTLES = 2

export interface FlavorPreferenceRank {
  tag: string
  bottleCount: number
}

export function getTopRatedFlavorTags(pours: Pour[], limit = 4): FlavorPreferenceRank[] {
  const highRated = pours.filter((p) => p.rating >= TOP_RATED_THRESHOLD)
  if (highRated.length < TOP_RATED_MIN_POURS) return []

  // Union each bottle's own high-rated pours into one label set per bottle
  // first — a bottle poured (and loved) five times still contributes its
  // flavors exactly once, never five times over. Built from each pour's own
  // structured tags + notes only (see pourFlavorLabels), never a bottle's
  // general `flavors`/`notes` field, which isn't tied to any specific pour
  // or rating and could describe an impression from a different tasting —
  // or one written before the bottle was ever opened.
  const labelsByBottle = new Map<string, Set<string>>()
  for (const pour of highRated) {
    const labels = labelsByBottle.get(pour.bottleId) ?? new Set<string>()
    for (const label of pourFlavorLabels(pour)) labels.add(label)
    labelsByBottle.set(pour.bottleId, labels)
  }
  if (labelsByBottle.size < TOP_RATED_MIN_BOTTLES) return []

  const bottleCountByLabel = new Map<string, number>()
  for (const labels of labelsByBottle.values()) {
    for (const label of labels) bottleCountByLabel.set(label, (bottleCountByLabel.get(label) ?? 0) + 1)
  }

  return [...bottleCountByLabel.entries()]
    .map(([tag, bottleCount]) => ({ tag, bottleCount }))
    .sort((a, b) => b.bottleCount - a.bottleCount || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}
