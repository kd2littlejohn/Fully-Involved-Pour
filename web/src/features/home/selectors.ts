import type { Bottle, Pour } from '../../data/types'
import { dominantFlavorAxis, identityLabelForAxis, pourFlavorLabels } from '../flavorRadar/flavorCategories'
import { buildPalateInsightText, BASELINE_MIN_POURS } from '../yourPalate/palateInsights'
import { fillLevelPercent, getPoursForBottle } from '../bottleDetails/selectors'
import { todayLocalIsoDate } from '../../data/localDate'
import { daysBetween } from '../axeInsights/engine'

const STALE_POUR_DAYS = 14

export function getFeaturedOpenBottle(bottles: Bottle[]): Bottle | undefined {
  return [...bottles]
    .filter((b) => b.status === 'open')
    .sort((a, b) => (b.openedDate ?? '').localeCompare(a.openedDate ?? ''))[0]
}

export function getRecentPours(pours: Pour[], limit = 4): Pour[] {
  return [...pours].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export interface MaybeTonightCandidate {
  bottle: Bottle
  reason: string
}

// Picks a small, varied set of "what to reach for" candidates, each with an
// honest reason grounded in that bottle's own data — never a generic
// placeholder. Priority order matches what actually makes a bottle worth
// suggesting tonight: a bottle that's gone quiet outranks one that's simply
// unopened, which outranks a favorite or a highly-rated bottle that's
// already getting regular attention.
// `excludeIds`: bottles already featured elsewhere on Home (Tonight's
// Pick), so the alternatives are actually alternatives.
export function getMaybeTonightCandidates(bottles: Bottle[], pours: Pour[], limit = 3, excludeIds: string[] = []): MaybeTonightCandidate[] {
  const lastPourDateByBottle = new Map<string, string>()
  for (const pour of pours) {
    const existing = lastPourDateByBottle.get(pour.bottleId)
    if (!existing || pour.date > existing) lastPourDateByBottle.set(pour.bottleId, pour.date)
  }

  // Calendar-day math on local dates (pour dates are local calendar days).
  const today = todayLocalIsoDate()
  // Wishlist/incoming/finished have nothing to pour tonight (not yet owned,
  // not yet arrived, or already done) — same pourable definition used
  // elsewhere (StartAPourButton's bottle picker, BottleCard's menu).
  const pourable = bottles.filter((b) => b.status === 'sealed' || b.status === 'open')

  const results: MaybeTonightCandidate[] = []
  const used = new Set<string>(excludeIds)
  function addCandidate(bottle: Bottle, reason: string) {
    if (used.has(bottle.id) || results.length >= limit) return
    used.add(bottle.id)
    results.push({ bottle, reason })
  }

  const staleOpen = pourable
    .filter((b) => b.status === 'open')
    .map((bottle) => {
      const lastDate = lastPourDateByBottle.get(bottle.id)
      const days = lastDate ? daysBetween(lastDate, today) : undefined
      return { bottle, days }
    })
    .filter((x) => x.days === undefined || x.days >= STALE_POUR_DAYS)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
  for (const { bottle, days } of staleOpen) {
    addCandidate(bottle, days !== undefined ? `You haven't poured this in ${days} days.` : "You haven't poured this yet.")
  }

  const sealed = pourable.filter((b) => b.status === 'sealed').sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  for (const bottle of sealed) {
    addCandidate(bottle, 'Still sealed.')
  }

  const favorites = pourable.filter((b) => b.favorite)
  for (const bottle of favorites) {
    addCandidate(bottle, 'One of your favorites.')
  }

  const highlyRated = [...pourable]
    .filter((b) => typeof b.rating === 'number')
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  for (const bottle of highlyRated) {
    addCandidate(bottle, 'One of your higher-rated bottles.')
  }

  return results
}

// Home's "Your Palate Lately" card. Two honest tiers, never empty while any
// pour exists:
//   - 'flavor': a flavor family clearly leads the user's recent *tagged*
//     pours. Pours with no flavor evidence (rating-only Quick Pours, legacy
//     guided-tasting pours without a fip breakdown) are skipped when
//     choosing the recent window instead of crowding tagged pours out.
//   - 'summary': otherwise, the same validated, rating-based insights
//     Profile → Your Palate shows (yourPalate/palateInsights.ts), plus a
//     plain note about why there's no flavor headline. No flavor notes or
//     component scores are ever invented.
export type PalateInsight =
  | {
      kind: 'flavor'
      headline: string
      primaryLabel: string
      primaryPercent: number
      secondaryLabel: string
      secondaryPercent: number
    }
  | {
      kind: 'summary'
      headline: string
      details: string[]
      flavorNote: string
    }

// Same baseline Your Palate uses before it shows patterns.
const PALATE_INSIGHT_MIN_TAGGED_POURS = BASELINE_MIN_POURS
const PALATE_INSIGHT_RECENT_COUNT = 5
// Below this, the "dominant" axis is barely ahead of the rest — not
// lopsided enough to be worth calling out as a pattern.
const PALATE_INSIGHT_MIN_SHARE = 55
const PALATE_INSIGHT_MAX_DETAILS = 2

export const FLAVOR_NOTE_NEEDS_TAGS = 'Add flavor notes when you log a pour to see your flavor trends here.'
export const FLAVOR_NOTE_BALANCED = 'No single flavor family stands out in your recent pours.'

export function getPalateInsight(bottles: Bottle[], pours: Pour[]): PalateInsight | undefined {
  const text = buildPalateInsightText(bottles, pours)
  if (!text) return undefined

  const recentTagged = [...pours]
    .filter((p) => typeof p.date === 'string' && pourFlavorLabels(p).size > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, PALATE_INSIGHT_RECENT_COUNT)

  if (recentTagged.length >= PALATE_INSIGHT_MIN_TAGGED_POURS) {
    const relevantIds = new Set(recentTagged.map((p) => p.bottleId))
    const relevantBottles = bottles.filter((b) => relevantIds.has(b.id))
    const dominant = dominantFlavorAxis(relevantBottles, recentTagged)
    if (dominant && dominant.percent >= PALATE_INSIGHT_MIN_SHARE) {
      const label = identityLabelForAxis(dominant.axis)
      return {
        kind: 'flavor',
        headline: `${label} notes have come up in most of your last ${recentTagged.length} tasted pours.`,
        primaryLabel: label,
        primaryPercent: dominant.percent,
        secondaryLabel: 'All Other Profiles',
        secondaryPercent: 100 - dominant.percent,
      }
    }
  }

  return {
    kind: 'summary',
    headline: text.summaryText,
    details: [text.evolutionText, text.proofEvolutionText, ...text.tastePatterns]
      .filter((line): line is string => Boolean(line))
      .slice(0, PALATE_INSIGHT_MAX_DETAILS),
    flavorNote: recentTagged.length >= PALATE_INSIGHT_MIN_TAGGED_POURS ? FLAVOR_NOTE_BALANCED : FLAVOR_NOTE_NEEDS_TAGS,
  }
}

export interface OpenBottleSummary {
  bottle: Bottle
  fillPercent: number | undefined
  lastPouredDate: string | undefined
  pourCount: number
}

// Most-recently-opened first — matches getFeaturedOpenBottle's own ordering
// so the carousel and "Continue Your Pour Story" agree on what's freshest.
export function getOpenBottles(bottles: Bottle[], pours: Pour[]): OpenBottleSummary[] {
  return [...bottles]
    .filter((b) => b.status === 'open')
    .sort((a, b) => (b.openedDate ?? '').localeCompare(a.openedDate ?? ''))
    .map((bottle) => {
      const bottlePours = getPoursForBottle(pours, bottle.id)
      return {
        bottle,
        fillPercent: fillLevelPercent(bottle),
        lastPouredDate: bottlePours[0]?.date,
        pourCount: bottlePours.length,
      }
    })
}

export interface CollectionSnapshot {
  // Bottles actually on the shelf: open + sealed. Wishlist and incoming
  // aren't owned yet and finished bottles are gone, so none count here.
  inBar: number
  open: number
  sealed: number
  // Open bottles that are empty (should be marked Finished) or down to
  // their last quarter (worth noting before they run out) — a real,
  // observable signal from the fill level the user already recorded, never
  // a guess.
  needingAttention: number
}

export function getCollectionSnapshot(bottles: Bottle[]): CollectionSnapshot {
  const open = bottles.filter((b) => b.status === 'open')
  const needingAttention = open.filter((b) => b.fillLevel === 'empty' || b.fillLevel === 'quarter').length

  const sealed = bottles.filter((b) => b.status === 'sealed').length
  return {
    inBar: open.length + sealed,
    open: open.length,
    sealed,
    needingAttention,
  }
}
