import type { Bottle, Pour } from '../../data/types'
import { fipTier } from '../fip/tiers'

export type JourneyCardVariant = 'standard' | 'featured'
export type JourneyCardFeatureReason = 'manual' | 'bottle-kill' | 'hall-of-fame'

export interface JourneyCardVariantResult {
  variant: JourneyCardVariant
  reason?: JourneyCardFeatureReason
}

// The single source of truth for whether a Journey entry gets the larger
// cinematic Featured card or the compact Standard split card. Every Journey
// feed must call this rather than re-deriving the rules.
//
// Deliberately does NOT feature a pour merely for being someone's first
// pour of a bottle, and deliberately does NOT treat "has an occasion" or
// "has a memory note" as a signal on its own — both fields are filled in on
// most ordinary pours (see pourWizard's SessionStep/SummaryStep), so either
// would make nearly every entry "featured" and defeat the whole point of
// the distinction.
//
// Two rules from the original design brief aren't implemented here because
// there's no safe existing signal for them yet (reported as an open gap,
// not approximated):
//   - "special occasion": Pour.occasion is free text with no curated
//     "meaningful milestone" vocabulary or boolean flag to check against.
//   - "completed blind result and this was the user's winning pour": Blind
//     Room tastings never write a Pour at all — they live entirely under
//     blindRooms/{roomId}/participants/{uid}/responses — so there is no
//     field on Pour to check without extra, unbudgeted Firestore reads per
//     card.
export function getJourneyCardVariant(pour: Pour, bottle: Bottle, poursForBottle: Pour[]): JourneyCardVariantResult {
  if (pour.isFeatured === true) return { variant: 'featured', reason: 'manual' }

  if (bottle.status === 'finished') {
    const mostRecent = [...poursForBottle].sort((a, b) => b.date.localeCompare(a.date))[0]
    if (mostRecent?.id === pour.id) return { variant: 'featured', reason: 'bottle-kill' }
  }

  if (fipTier(pour.rating).label === 'Hall of Fame') return { variant: 'featured', reason: 'hall-of-fame' }

  return { variant: 'standard' }
}

export const FEATURE_REASON_LABEL: Record<JourneyCardFeatureReason, string> = {
  manual: 'Featured Memory',
  'bottle-kill': 'Bottle Kill',
  'hall-of-fame': 'Hall of Fame',
}

export interface JourneyFeedEntry {
  pour: Pour
  bottle: Bottle
  variant: JourneyCardVariant
  reason?: JourneyCardFeatureReason
}

// Composes getJourneyCardVariant across a whole feed (newest first) and
// keeps the page from turning into a wall of oversized cards: Featured
// cards never appear back-to-back, even if two consecutive entries would
// otherwise both qualify — the second is shown Standard instead, purely for
// visual rhythm (it doesn't change what's true about the entry, only how
// this render paces it).
export function getJourneyFeedEntries(pours: Pour[], bottles: Bottle[]): JourneyFeedEntry[] {
  const bottleById = new Map(bottles.map((b) => [b.id, b]))
  const poursByBottle = new Map<string, Pour[]>()
  for (const pour of pours) {
    const list = poursByBottle.get(pour.bottleId)
    if (list) list.push(pour)
    else poursByBottle.set(pour.bottleId, [pour])
  }

  const sorted = [...pours].sort((a, b) => b.date.localeCompare(a.date))

  const entries: JourneyFeedEntry[] = []
  let previousWasFeatured = false
  for (const pour of sorted) {
    const bottle = bottleById.get(pour.bottleId)
    if (!bottle) continue

    const result = getJourneyCardVariant(pour, bottle, poursByBottle.get(pour.bottleId) ?? [pour])
    const variant: JourneyCardVariant = result.variant === 'featured' && previousWasFeatured ? 'standard' : result.variant
    entries.push({ pour, bottle, variant, reason: variant === 'featured' ? result.reason : undefined })
    previousWasFeatured = variant === 'featured'
  }

  return entries
}
