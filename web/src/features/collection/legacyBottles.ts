import type { Bottle } from '../../data/types'
import type { BottlePatch } from '../../hooks/useUserData'

// Legacy Bottles are the user's personally meaningful bottles — the
// existing legacyShelf / legacyShelfReason fields (set in the original app
// and still read by What Should I Pour), never a rarity tier. Any status
// counts, finished included: a bottle keeps its Legacy status for good.
// Order: ones with a story first, then the longest-held.
export function legacyBottles(bottles: Bottle[]): Bottle[] {
  return bottles
    .filter((bottle) => bottle.legacyShelf && bottle.status !== 'wishlist')
    .sort((a, b) => {
      const story = Number(hasLegacyStory(b)) - Number(hasLegacyStory(a))
      if (story !== 0) return story
      return (a.createdAt ?? 0) - (b.createdAt ?? 0)
    })
}

// Bottles that could become a Legacy Bottle: anything the user actually
// has or had (not wishlist), not already Legacy.
export function legacyCandidates(bottles: Bottle[]): Bottle[] {
  return bottles.filter((bottle) => !bottle.legacyShelf && bottle.status !== 'wishlist').sort((a, b) => a.name.localeCompare(b.name))
}

export function hasLegacyStory(bottle: Bottle): boolean {
  return Boolean(bottle.legacyShelfReason?.trim() || bottle.legacyStory?.trim() || bottle.legacyStoryTitle?.trim())
}

// The one line the Legacy Bottle card quotes: the short "why it matters"
// if there is one, otherwise the opening of the full story.
export function legacyCardQuote(bottle: Bottle): string | undefined {
  return bottle.legacyShelfReason?.trim() || bottle.legacyStory?.trim() || undefined
}

export const LEGACY_LIMITS = {
  title: 80,
  reason: 200,
  story: 4000,
  occasion: 120,
} as const

export interface LegacyStoryDraft {
  title: string
  reason: string
  story: string
  occasion: string
  date: string
}

export function legacyStoryDraft(bottle: Bottle): LegacyStoryDraft {
  return {
    title: bottle.legacyStoryTitle ?? '',
    reason: bottle.legacyShelfReason ?? '',
    story: bottle.legacyStory ?? '',
    occasion: bottle.legacyOccasion ?? '',
    date: bottle.legacyDate ?? '',
  }
}

// Draft → bottle patch. A cleared field is written as undefined, which
// drops it from the saved bottle (Firestore runs with
// ignoreUndefinedProperties and the bottles array is written whole).
export function legacyStoryPatch(draft: LegacyStoryDraft, now = Date.now()): BottlePatch {
  const clean = (value: string, max: number) => value.trim().slice(0, max) || undefined
  return {
    legacyStoryTitle: clean(draft.title, LEGACY_LIMITS.title),
    legacyShelfReason: clean(draft.reason, LEGACY_LIMITS.reason),
    legacyStory: clean(draft.story, LEGACY_LIMITS.story),
    legacyOccasion: clean(draft.occasion, LEGACY_LIMITS.occasion),
    legacyDate: /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : undefined,
    legacyStoryUpdatedAt: now,
  }
}

// "Jun 14, 2019" from a YYYY-MM-DD date, read in UTC so no timezone can
// shift the day.
export function formatLegacyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
