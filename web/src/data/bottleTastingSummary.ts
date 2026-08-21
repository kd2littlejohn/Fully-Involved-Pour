import type { Bottle, FriendBottleTake, Pour } from './types'

const TOP_NOTES_LIMIT = 6
const CATEGORY_LIMIT = 3
// Newest pour of a bottle counts up to 50% more than the oldest — repeated
// notes still dominate the ranking (a note mentioned in 4 of 5 pours always
// outranks a note only the single most recent pour mentioned), but a
// pattern that's shifting gets to show it without one recent, unusual
// mention erasing everything before it.
const MAX_RECENCY_BONUS = 0.5

// A fixed, real-word vocabulary matched against the owner's own free-text
// finishNotes — there's no structured finish-tag field on Pour the way
// nose/palate have noseAromas/palateFlavors, so this is the only way to
// get finish descriptors at all without inventing them. Every word shown
// is one the owner actually typed; this just finds which of them are
// common-enough whiskey finish descriptors worth surfacing as chips.
const FINISH_DESCRIPTORS = [
  'long',
  'short',
  'warm',
  'hot',
  'spicy',
  'smooth',
  'dry',
  'sweet',
  'oaky',
  'lingering',
  'clean',
  'bitter',
  'peppery',
  'bold',
  'mellow',
  'balanced',
  'complex',
  'harsh',
]

function getPoursForBottle(pours: Pour[], bottleId: string): Pour[] {
  return [...pours.filter((p) => p.bottleId === bottleId)].sort((a, b) => a.date.localeCompare(b.date))
}

function extractFinishDescriptors(text: string | undefined): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  return FINISH_DESCRIPTORS.filter((word) => new RegExp(`\\b${word}\\b`).test(lower))
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
  const finishCounts = weightedCounts(chronological, (p) => extractFinishDescriptors(p.fip.finishNotes))

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
