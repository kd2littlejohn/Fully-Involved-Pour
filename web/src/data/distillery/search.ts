import { DISTILLERIES, normalizeDistilleryName } from './index'
import type { Distillery } from './types'

const SEARCH_LIMIT = 8

// Ross & Squibb (a real distillery) plus the three sourcing placeholders —
// shown by default so "I don't know the distillery" is always one tap
// away without typing anything (see seeds/special.ts).
const DEFAULT_SUGGESTIONS = DISTILLERIES.filter((d) =>
  ['ross-and-squibb-distillery', 'undisclosed-source', 'contract-distilled', 'unknown-distillery'].includes(d.id),
)

function scoreMatch(distillery: Distillery, normalizedQuery: string): number | undefined {
  const haystacks = [distillery.normalizedName, ...distillery.aliases.map(normalizeDistilleryName)]
  let best: number | undefined
  for (const haystack of haystacks) {
    let score: number | undefined
    if (haystack === normalizedQuery) score = 0
    else if (haystack.startsWith(normalizedQuery)) score = 1
    else if (haystack.split(' ').some((word) => word.startsWith(normalizedQuery))) score = 2
    else if (haystack.includes(normalizedQuery)) score = 3
    if (score !== undefined && (best === undefined || score < best)) best = score
  }
  return best
}

// Matches against both official names and aliases (e.g. "MGP" finds Ross &
// Squibb Distillery, "BT" finds Buffalo Trace). An empty query returns the
// sourcing-placeholder shortlist rather than nothing, so those options are
// always reachable without typing.
export function searchDistilleries(query: string, limit = SEARCH_LIMIT): Distillery[] {
  const normalizedQuery = normalizeDistilleryName(query)
  if (!normalizedQuery) return DEFAULT_SUGGESTIONS.slice(0, limit)

  return DISTILLERIES.map((distillery) => ({ distillery, score: scoreMatch(distillery, normalizedQuery) }))
    .filter((entry): entry is { distillery: Distillery; score: number } => entry.score !== undefined)
    .sort((a, b) => a.score - b.score || a.distillery.name.localeCompare(b.distillery.name))
    .slice(0, limit)
    .map((entry) => entry.distillery)
}

export function getDistilleryById(id: string): Distillery | undefined {
  return DISTILLERIES.find((d) => d.id === id)
}

// Exact (normalized) match only — used to resolve a bottle's free-text
// `distillery` string back to a canonical record, e.g. so bottle search can
// match "MGP" against a bottle stored as "Ross & Squibb Distillery".
export function resolveDistillery(text: string | undefined): Distillery | undefined {
  if (!text?.trim()) return undefined
  const normalized = normalizeDistilleryName(text)
  return DISTILLERIES.find((d) => d.normalizedName === normalized || d.aliases.some((a) => normalizeDistilleryName(a) === normalized))
}

export interface DistilleryOption {
  id: string
  label: string
  sublabel?: string
}

export function distilleryToOption(distillery: Distillery): DistilleryOption {
  const location = [distillery.city, distillery.stateProvince, distillery.country].filter(Boolean).join(', ')
  return { id: distillery.id, label: distillery.name, sublabel: location || undefined }
}

// Bottle-name/distillery substring matching is unchanged from the app's
// existing search (see pages/Collection/CollectionPage.tsx); this adds
// distillery-alias matching on top so "MGP" or "BT" finds bottles stored
// under the distillery's full canonical name.
export function bottleDistilleryMatches(bottleDistillery: string | undefined, query: string): boolean {
  const resolved = resolveDistillery(bottleDistillery)
  if (!resolved) return false
  const normalizedQuery = normalizeDistilleryName(query)
  if (!normalizedQuery) return false
  if (resolved.normalizedName.includes(normalizedQuery)) return true
  return resolved.aliases.some((alias) => normalizeDistilleryName(alias).includes(normalizedQuery))
}
