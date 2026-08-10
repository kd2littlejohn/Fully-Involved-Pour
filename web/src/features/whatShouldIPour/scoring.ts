import type { Bottle, Pour } from '../../data/types'
import { getCurrentScore, getPoursForBottle } from '../bottleDetails/selectors'
import { computeCoreBarScore } from '../coreBar/selectors'
import { FLAVOR_AXES, flavorRadarValues, type FlavorAxis } from '../flavorRadar/flavorCategories'
import { buyAgainToValueScore } from '../fip/scoring'
import { MOODS, type MoodId } from './moods'

const DAY_MS = 24 * 60 * 60 * 1000

// Sealed bottles compete on equal footing only for these moods — everywhere
// else "ordinary" recommendations should favor a bottle that's already open
// (per product decision: opening something new is a bigger ask than pouring
// what's already on the shelf).
const SEALED_PENALTY_EXEMPT = new Set<MoodId>(['something-special', 'explore-bar', 'surprise-me'])
const SEALED_PENALTY = 0.55

// Surprise Me excludes known-poor bottles (below the FIP "Routine Call"
// floor) unless doing so would leave nothing to recommend.
const POOR_RATING_FLOOR = 6.0

export interface Candidate {
  bottle: Bottle
  pourCount: number
  /** undefined = never poured */
  daysSinceLastPour: number | undefined
  rating: number | undefined
  proof: number | undefined
  coreBarScore: number
  legacyShelf: boolean
  flavors: Record<FlavorAxis, number> | undefined
  companionPourCount: number
  /** undefined = no pour of this bottle has a buyAgain value logged */
  buyAgainAvg: number | undefined
  /** 1 = a type/category the user rarely logs pours from, 0 = their most-poured category */
  categoryRarity: number
  isOpen: boolean
}

export interface RecommendationResult {
  bottle: Bottle
  moodId: MoodId
  reasons: string[]
}

interface MoodContext {
  ratingRange: { min: number; max: number }
  proofRange: { min: number; max: number }
  pourCountMax: number
  coreBarMax: number
  companionMax: number
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

function poolRange(candidates: Candidate[], pick: (c: Candidate) => number | undefined): { min: number; max: number } {
  const values = candidates.map(pick).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (values.length === 0) return { min: 0, max: 0 }
  return { min: Math.min(...values), max: Math.max(...values) }
}

// Builds every candidate bottle's feature set once, so every mood scores off
// the same real, precomputed signals — never re-derived per mood.
export function buildCandidates(bottles: Bottle[], pours: Pour[]): Candidate[] {
  const eligible = bottles.filter((b) => (b.status === 'open' || b.status === 'sealed') && !!b.name?.trim())

  // "Underexplored category" is relative to the user's whole pour history,
  // not just today's eligible pool.
  const categoryPourCounts = new Map<string, number>()
  for (const pour of pours) {
    const type = bottles.find((b) => b.id === pour.bottleId)?.type?.trim()
    if (!type) continue
    categoryPourCounts.set(type, (categoryPourCounts.get(type) ?? 0) + 1)
  }
  const maxCategoryPours = Math.max(0, ...categoryPourCounts.values())

  return eligible.map((bottle) => {
    const bottlePours = getPoursForBottle(pours, bottle.id)
    const latest = bottlePours[0]
    const flavorVals = flavorRadarValues(bottle, pours)
    const flavors = flavorVals
      ? (Object.fromEntries(FLAVOR_AXES.map((axis, i) => [axis, flavorVals[i] ?? 0])) as Record<FlavorAxis, number>)
      : undefined
    const buyAgainValues = bottlePours.filter((p) => p.buyAgain).map((p) => buyAgainToValueScore(p.buyAgain))
    const type = bottle.type?.trim()
    const categoryCount = type ? (categoryPourCounts.get(type) ?? 0) : 0

    return {
      bottle,
      pourCount: bottlePours.length,
      daysSinceLastPour: latest ? (Date.now() - new Date(latest.date).getTime()) / DAY_MS : undefined,
      rating: getCurrentScore(bottle, pours),
      proof: bottle.proof,
      coreBarScore: computeCoreBarScore(bottle, pours),
      legacyShelf: !!bottle.legacyShelf,
      flavors,
      companionPourCount: bottlePours.filter((p) => p.companion?.trim()).length,
      buyAgainAvg: buyAgainValues.length > 0 ? buyAgainValues.reduce((a, b) => a + b, 0) / buyAgainValues.length : undefined,
      categoryRarity: 1 - normalize(categoryCount, 0, maxCategoryPours),
      isOpen: bottle.status === 'open',
    }
  })
}

function buildContext(candidates: Candidate[]): MoodContext {
  return {
    ratingRange: poolRange(candidates, (c) => c.rating),
    proofRange: poolRange(candidates, (c) => c.proof),
    pourCountMax: Math.max(0, ...candidates.map((c) => c.pourCount)),
    coreBarMax: Math.max(0, ...candidates.map((c) => c.coreBarScore)),
    companionMax: Math.max(0, ...candidates.map((c) => c.companionPourCount)),
  }
}

function flavor(c: Candidate, axis: FlavorAxis): number {
  return c.flavors?.[axis] ?? 0
}

// Missing rating/proof gets a mild neutral value rather than 0 — a bottle
// you haven't rated yet shouldn't be scored as if it were actively bad.
function ratingNorm(c: Candidate, ctx: MoodContext): number {
  return c.rating === undefined ? 0.4 : normalize(c.rating, ctx.ratingRange.min, ctx.ratingRange.max)
}

function proofNorm(c: Candidate, ctx: MoodContext): number {
  return c.proof === undefined ? 0.4 : normalize(c.proof, ctx.proofRange.min, ctx.proofRange.max)
}

function pourCountNorm(c: Candidate, ctx: MoodContext): number {
  return normalize(c.pourCount, 0, ctx.pourCountMax)
}

function coreBarNorm(c: Candidate, ctx: MoodContext): number {
  return normalize(c.coreBarScore, 0, ctx.coreBarMax)
}

function companionNorm(c: Candidate, ctx: MoodContext): number {
  return normalize(c.companionPourCount, 0, ctx.companionMax)
}

// How neglected this bottle is: never-poured counts as maximally neglected.
function neglectNorm(c: Candidate, daysMax: number): number {
  if (c.daysSinceLastPour === undefined) return 1
  return normalize(c.daysSinceLastPour, 0, daysMax)
}

// Peaks at the pool's proof midpoint, falls off toward either extreme.
function moderateProofCloseness(c: Candidate, ctx: MoodContext): number {
  return 1 - Math.abs(proofNorm(c, ctx) - 0.5) * 2
}

function approachability(c: Candidate): number {
  return flavor(c, 'Sweet') * 0.7 + (1 - flavor(c, 'Smoky')) * 0.3
}

type DeterministicMoodId = Exclude<MoodId, 'surprise-me'>

const MOOD_SCORERS: Record<DeterministicMoodId, (c: Candidate, ctx: MoodContext, daysMax: number) => number> = {
  'big-bold': (c, ctx) => 0.35 * proofNorm(c, ctx) + 0.3 * ratingNorm(c, ctx) + 0.2 * flavor(c, 'Spicy') + 0.15 * flavor(c, 'Woody'),
  'easy-night': (c, ctx) =>
    0.3 * moderateProofCloseness(c, ctx) + 0.25 * ratingNorm(c, ctx) + 0.25 * pourCountNorm(c, ctx) + 0.2 * approachability(c),
  'something-special': (c, ctx) =>
    0.3 * (c.legacyShelf ? 1 : 0) + 0.25 * coreBarNorm(c, ctx) + 0.3 * ratingNorm(c, ctx) + 0.15 * (1 - pourCountNorm(c, ctx)),
  'explore-bar': (c, _ctx, daysMax) => 0.4 * (c.pourCount === 0 ? 1 : 0) + 0.3 * neglectNorm(c, daysMax) + 0.3 * c.categoryRarity,
  'sharing-friends': (c, ctx) => 0.35 * companionNorm(c, ctx) + 0.3 * (c.buyAgainAvg ?? 0.4) + 0.35 * ratingNorm(c, ctx),
  nightcap: (c, ctx) => 0.3 * flavor(c, 'Sweet') + 0.25 * flavor(c, 'Woody') + 0.2 * flavor(c, 'Fruity') + 0.25 * ratingNorm(c, ctx),
}

export function scoreCandidate(candidate: Candidate, moodId: DeterministicMoodId, ctx: MoodContext, daysMax: number): number {
  const base = MOOD_SCORERS[moodId](candidate, ctx, daysMax)
  const sealedPenalty = !candidate.isOpen && !SEALED_PENALTY_EXEMPT.has(moodId) ? SEALED_PENALTY : 1
  return base * sealedPenalty
}

function compareCandidatesDesc(a: Candidate, b: Candidate): number {
  const aDays = a.daysSinceLastPour ?? Infinity
  const bDays = b.daysSinceLastPour ?? Infinity
  if (aDays !== bDays) return bDays - aDays
  return a.bottle.id.localeCompare(b.bottle.id)
}

export function getSurpriseMeCandidates(candidates: Candidate[]): Candidate[] {
  const notPoor = candidates.filter((c) => c.rating === undefined || c.rating >= POOR_RATING_FLOOR)
  return notPoor.length > 0 ? notPoor : candidates
}

// Generic weighted-random draw — kept standalone (not tangled into the
// deterministic scorers) so Roll the Dice can later be pointed at Surprise
// Me, or this same helper, without touching the recommendation engine.
export function pickWeightedRandom<T>(items: { item: T; weight: number }[], random: () => number = Math.random): T | undefined {
  const pool = items.some((i) => i.weight > 0) ? items.filter((i) => i.weight > 0) : items.map((i) => ({ ...i, weight: 1 }))
  const total = pool.reduce((sum, i) => sum + i.weight, 0)
  if (pool.length === 0 || total <= 0) return undefined
  let r = random() * total
  for (const entry of pool) {
    r -= entry.weight
    if (r <= 0) return entry.item
  }
  return pool[pool.length - 1]?.item
}

function moodLabel(moodId: MoodId): string {
  return MOODS.find((m) => m.id === moodId)?.label ?? 'this'
}

// Always leads with an honest, verifiable statement of this bottle's actual
// pour history (or lack of one) — never implies a prior pour that didn't
// happen — then adds at most one more mood-relevant real signal.
function explainRecommendation(candidate: Candidate, moodId: MoodId, ctx: MoodContext): string[] {
  const reasons: string[] = []

  if (!candidate.isOpen) {
    reasons.push("You've never opened this bottle — it's still sealed.")
  } else if (candidate.pourCount === 0) {
    reasons.push("You've never logged a pour from this bottle.")
  } else if (candidate.pourCount === 1) {
    reasons.push("You've only poured this once.")
  } else if (candidate.daysSinceLastPour !== undefined && candidate.daysSinceLastPour >= 21) {
    reasons.push(`You haven't poured this in ${Math.round(candidate.daysSinceLastPour)} days.`)
  }

  const secondary: string[] = []
  if (candidate.legacyShelf) secondary.push('This is a Legacy Shelf bottle.')
  if (moodId === 'sharing-friends' && candidate.companionPourCount > 0) {
    secondary.push("You've shared this bottle with company before.")
  }
  if (ctx.coreBarMax > 0 && candidate.coreBarScore === ctx.coreBarMax) {
    secondary.push('This is one of your Core Bar bottles — one you keep coming back to.')
  }
  if (candidate.rating !== undefined && ctx.ratingRange.max > 0 && candidate.rating === ctx.ratingRange.max) {
    secondary.push(`This is one of your highest-rated ${candidate.isOpen ? 'open ' : ''}bottles.`)
  }

  for (const reason of secondary) {
    if (reasons.length >= 2) break
    if (!reasons.includes(reason)) reasons.push(reason)
  }

  if (reasons.length === 0) {
    reasons.push(`A strong fit for a ${moodLabel(moodId)} pour right now.`)
  }

  return reasons
}

// The main entry point. `exclude` holds bottle ids already shown this modal
// session (for "Show Me Another"); when every eligible bottle has been
// excluded, it resets rather than dead-ending, while still avoiding an
// immediate repeat of whichever bottle was just shown.
export function getRecommendation(
  bottles: Bottle[],
  pours: Pour[],
  moodId: MoodId,
  exclude: string[] = [],
  random: () => number = Math.random,
): RecommendationResult | undefined {
  const allCandidates = buildCandidates(bottles, pours)
  if (allCandidates.length === 0) return undefined

  let pool = allCandidates.filter((c) => !exclude.includes(c.bottle.id))
  if (pool.length === 0) {
    const last = exclude[exclude.length - 1]
    pool = allCandidates.filter((c) => c.bottle.id !== last)
    if (pool.length === 0) pool = allCandidates
  }

  const ctx = buildContext(allCandidates)

  if (moodId === 'surprise-me') {
    const weighted = getSurpriseMeCandidates(pool).map((c) => ({
      item: c,
      weight: c.rating !== undefined ? 0.3 + 0.7 * normalize(c.rating, ctx.ratingRange.min, ctx.ratingRange.max) : 0.5,
    }))
    const picked = pickWeightedRandom(weighted, random)
    if (!picked) return undefined
    return { bottle: picked.bottle, moodId, reasons: explainRecommendation(picked, moodId, ctx) }
  }

  const daysMax = Math.max(0, ...allCandidates.map((c) => c.daysSinceLastPour ?? 0))

  const [top] = pool
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, moodId, ctx, daysMax) }))
    .sort((a, b) => b.score - a.score || compareCandidatesDesc(a.candidate, b.candidate))

  if (!top) return undefined
  return { bottle: top.candidate.bottle, moodId, reasons: explainRecommendation(top.candidate, moodId, ctx) }
}
