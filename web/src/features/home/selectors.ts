import type { Bottle, Pour } from '../../data/types'
import { dominantFlavorAxis } from '../flavorRadar/flavorCategories'

const DAY_MS = 24 * 60 * 60 * 1000
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
export function getMaybeTonightCandidates(bottles: Bottle[], pours: Pour[], limit = 3): MaybeTonightCandidate[] {
  const lastPourDateByBottle = new Map<string, string>()
  for (const pour of pours) {
    const existing = lastPourDateByBottle.get(pour.bottleId)
    if (!existing || pour.date > existing) lastPourDateByBottle.set(pour.bottleId, pour.date)
  }

  const now = Date.now()
  // Wishlist/incoming/finished have nothing to pour tonight (not yet owned,
  // not yet arrived, or already done) — same pourable definition used
  // elsewhere (StartAPourButton's bottle picker, BottleCard's menu).
  const pourable = bottles.filter((b) => b.status === 'sealed' || b.status === 'open')

  const results: MaybeTonightCandidate[] = []
  const used = new Set<string>()
  function addCandidate(bottle: Bottle, reason: string) {
    if (used.has(bottle.id) || results.length >= limit) return
    used.add(bottle.id)
    results.push({ bottle, reason })
  }

  const staleOpen = pourable
    .filter((b) => b.status === 'open')
    .map((bottle) => {
      const lastDate = lastPourDateByBottle.get(bottle.id)
      const days = lastDate ? Math.floor((now - new Date(lastDate).getTime()) / DAY_MS) : undefined
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

export interface PalateInsight {
  headline: string
  primaryLabel: string
  primaryPercent: number
  secondaryLabel: string
  secondaryPercent: number
}

const PALATE_INSIGHT_MIN_POURS = 5
const PALATE_INSIGHT_RECENT_COUNT = 5
// Below this, the "dominant" axis is barely ahead of the rest — not
// lopsided enough to be worth calling out as a pattern.
const PALATE_INSIGHT_MIN_SHARE = 55

// One honest, single headline about recent taste patterns — not the full
// Your Palate breakdown (that's features/yourPalate, still on Profile).
// Scoped to the most recent pours specifically ("lately"), not all-time.
export function getPalateInsight(bottles: Bottle[], pours: Pour[]): PalateInsight | undefined {
  if (pours.length < PALATE_INSIGHT_MIN_POURS) return undefined
  const recent = getRecentPours(pours, PALATE_INSIGHT_RECENT_COUNT)
  const relevantIds = new Set(recent.map((p) => p.bottleId))
  const relevantBottles = bottles.filter((b) => relevantIds.has(b.id))
  const dominant = dominantFlavorAxis(relevantBottles, recent)
  if (!dominant || dominant.percent < PALATE_INSIGHT_MIN_SHARE) return undefined

  return {
    headline: `${dominant.axis}-forward notes have come up in most of your last ${recent.length} ${recent.length === 1 ? 'pour' : 'pours'}.`,
    primaryLabel: `${dominant.axis}-Forward`,
    primaryPercent: dominant.percent,
    secondaryLabel: 'All Other Profiles',
    secondaryPercent: 100 - dominant.percent,
  }
}
