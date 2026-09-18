import type { Bottle, FriendBottleTake, Pour } from './types'
import { FINISH_DESCRIPTORS as TAXONOMY_FINISH_DESCRIPTORS } from '../features/flavorTaxonomy/taxonomy'

const TOP_NOTES_LIMIT = 6
const CATEGORY_LIMIT = 3
// Newest pour of a bottle counts up to 50% more than the oldest — repeated
// notes still dominate the ranking (a note mentioned in 4 of 5 pours always
// outranks a note only the single most recent pour mentioned), but a
// pattern that's shifting gets to show it without one recent, unusual
// mention erasing everything before it.
const MAX_RECENCY_BONUS = 0.5

// Words this function recognized before the centralized Finish taxonomy
// existed but that aren't in its canonical chip list — kept so free-text
// extraction on older pours doesn't lose any recognition coverage.
const LEGACY_EXTRA_FINISH_WORDS = ['peppery', 'bold', 'mellow', 'balanced', 'complex', 'harsh']
const FINISH_WORDS = [...new Set([...TAXONOMY_FINISH_DESCRIPTORS.map((d) => d.label.toLowerCase()), ...LEGACY_EXTRA_FINISH_WORDS])]

function getPoursForBottle(pours: Pour[], bottleId: string): Pour[] {
  return [...pours.filter((p) => p.bottleId === bottleId)].sort((a, b) => a.date.localeCompare(b.date))
}

function extractFinishDescriptorsFromText(text: string | undefined): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  return FINISH_WORDS.filter((word) => new RegExp(`\\b${word}\\b`).test(lower))
}

// Prefers the pour's own structured Finish tags (the exact words the owner
// selected) when present — no more guessing from prose. Falls back to the
// free-text regex scan of finishNotes for pours saved before finishTags
// existed. Both paths return lowercase words, the same output shape this
// function has always had, so a bottle with a mix of old and new pours
// never fragments its ranking by casing.
function extractFinishDescriptors(pour: Pour): string[] {
  if (pour.fip.finishTags && pour.fip.finishTags.length > 0) {
    return pour.fip.finishTags.map((tag) => tag.toLowerCase())
  }
  return extractFinishDescriptorsFromText(pour.fip.finishNotes)
}

// Repeated notes matter more than one-off ones (plain frequency), and
// newer pours count slightly more (a small recency ramp) — but neither
// dominates: a single recent unusual note can only ever outweigh a
// long-standing pattern by at most the recency bonus, never erase it.
function weightedCounts(chronologicalPours: Pour[], extract: (pour: Pour) => string[]): Map<string, number> {
  const counts = new Map<string, number>()
  const last = Math.max(1, chronologicalPours.length - 1)
  chronologicalPours.forEach((pour, index) => {
    const recencyWeight = 1 + (index / last) * MAX_RECENCY_BONUS
    for (const note of extract(pour)) {
      const key = note.trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + recencyWeight)
    }
  })
  return counts
}

function topByWeight(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term)
}

// A real, computed shift in how often a nose/palate term shows up in the
// most recent 3 pours vs. everything before — the raw evidence "bottle
// evolution" is built from. Needs at least 4 pours (3 recent + 1+ earlier
// to compare against) and a clear jump, not a marginal one, so this stays
// silent rather than guessing on thin data.
const EVOLUTION_MIN_POURS = 4
const EVOLUTION_MIN_RECENT_RATE = 0.66
const EVOLUTION_MIN_RATE_JUMP = 0.4

function findEvolvingTerm(chronologicalPours: Pour[]): string | undefined {
  if (chronologicalPours.length < EVOLUTION_MIN_POURS) return undefined
  const recent = chronologicalPours.slice(-3)
  const earlier = chronologicalPours.slice(0, -3)
  if (earlier.length === 0) return undefined

  const termsIn = (pour: Pour) => [...pour.fip.noseAromas, ...pour.fip.palateFlavors]
  const allTerms = new Set([...recent, ...earlier].flatMap(termsIn))

  let best: { term: string; jump: number } | undefined
  for (const term of allTerms) {
    const recentRate = recent.filter((p) => termsIn(p).includes(term)).length / recent.length
    const earlierRate = earlier.filter((p) => termsIn(p).includes(term)).length / earlier.length
    const jump = recentRate - earlierRate
    if (recentRate >= EVOLUTION_MIN_RECENT_RATE && jump >= EVOLUTION_MIN_RATE_JUMP) {
      if (!best || jump > best.jump) best = { term, jump }
    }
  }
  return best?.term
}

// The owner's own real, aggregated tasting history for one bottle —
// computed once from their own Bottle + Pours (Quick Pours and full Pour
// Stories write to the same Pour records, so both are already included
// with no extra source to check). Called at sync time
// (data/repositories/sharedCollections.ts), not on every Friend Bottle
// Quick View open — the viewer just reads the one already-aggregated
// result. Nothing here composes English sentences: that happens at view
// time once the viewer's framing (the friend's name) is known — see
// features/friends/describeFriendTake.ts.
export function buildBottleTastingSummary(bottle: Bottle, pours: Pour[]): FriendBottleTake | undefined {
  const chronological = getPoursForBottle(pours, bottle.id)
  const latest = chronological[chronological.length - 1]

  if (!latest && bottle.rating === undefined && !bottle.buyAgain && !bottle.wouldReplace) return undefined

  const noseCounts = weightedCounts(chronological, (p) => p.fip.noseAromas)
  const palateCounts = weightedCounts(chronological, (p) => p.fip.palateFlavors)
  const finishCounts = weightedCounts(chronological, (p) => extractFinishDescriptors(p))

  const noseNotes = topByWeight(noseCounts, CATEGORY_LIMIT)
  const palateNotes = topByWeight(palateCounts, CATEGORY_LIMIT)
  const finishNotes = topByWeight(finishCounts, CATEGORY_LIMIT)

  const combined = new Map<string, number>()
  for (const [term, weight] of [...noseCounts, ...palateCounts]) {
    combined.set(term, (combined.get(term) ?? 0) + weight)
  }
  const topNotes = topByWeight(combined, TOP_NOTES_LIMIT)

  const averageScore = chronological.length >= 2 ? chronological.reduce((sum, p) => sum + p.rating, 0) / chronological.length : undefined

  return {
    score: latest?.rating ?? bottle.rating,
    averageScore: averageScore !== undefined ? Math.round(averageScore * 10) / 10 : undefined,
    latestTake: latest?.memory?.trim() || latest?.notes?.trim() || undefined,
    buyAgain: bottle.buyAgain,
    wouldReplace: bottle.wouldReplace,
    noseNotes: noseNotes.length > 0 ? noseNotes : undefined,
    palateNotes: palateNotes.length > 0 ? palateNotes : undefined,
    finishNotes: finishNotes.length > 0 ? finishNotes : undefined,
    topNotes: topNotes.length > 0 ? topNotes : undefined,
    evolvingTerm: findEvolvingTerm(chronological),
    pourCount: chronological.length,
    lastPourDate: latest?.date,
  }
}
