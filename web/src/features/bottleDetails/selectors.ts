import type { Bottle, Memory, Pour } from '../../data/types'

export function mashBillSummary(bottle: Bottle): string | undefined {
  const parts: string[] = []
  if (bottle.mashBillCorn) parts.push(`${bottle.mashBillCorn}% Corn`)
  if (bottle.mashBillRyeWheat) parts.push(`${bottle.mashBillRyeWheat}% Rye/Wheat`)
  if (bottle.mashBillMalted) parts.push(`${bottle.mashBillMalted}% Malted Barley`)
  return parts.length > 0 ? parts.join(' / ') : undefined
}

export function getPoursForBottle(pours: Pour[], bottleId: string): Pour[] {
  return pours.filter((p) => p.bottleId === bottleId).sort((a, b) => b.date.localeCompare(a.date))
}

export function getCurrentScore(bottle: Bottle, pours: Pour[]): number | undefined {
  const bottlePours = getPoursForBottle(pours, bottle.id)
  const latest = bottlePours[0]
  if (latest) return latest.rating
  return bottle.rating
}

const PROGRESSION_FULL_LIMIT = 6

// A single calm line, never a chart. Below 2 pours there's nothing to show
// progression of. Up to 6 pours shows every real value; beyond that, only
// the first and last real values (never interpolated) to keep it one line.
export function buildRatingProgression(bottlePours: Pour[]): string | undefined {
  if (bottlePours.length < 2) return undefined
  const chronological = [...bottlePours].sort((a, b) => a.date.localeCompare(b.date))
  const ratings = chronological.map((p) => p.rating.toFixed(1))
  if (ratings.length <= PROGRESSION_FULL_LIMIT) return ratings.join(' → ')
  return `${ratings[0]} → … → ${ratings[ratings.length - 1]}`
}

export interface ScoreEvolutionPoint {
  label: string
  score: number
  date: string
}

export interface ScoreEvolution {
  points: ScoreEvolutionPoint[]
  // true once points have been trimmed to first/last only — same "keep it
  // one line, never fabricate the middle" discipline as buildRatingProgression.
  truncated: boolean
}

// Same "shown when enough data exists" gate as buildRatingProgression: a
// single pour has no evolution to show yet. The first real pour is always
// "Neck Pour" (the freshly-opened top of the bottle); the last pour on a
// finished bottle is "Bottle Kill" — both real whiskey-community terms, not
// invented labels. Everything between is just numbered.
export function buildScoreEvolution(bottle: Bottle, pours: Pour[]): ScoreEvolution | undefined {
  const chronological = [...getPoursForBottle(pours, bottle.id)].sort((a, b) => a.date.localeCompare(b.date))
  if (chronological.length < 2) return undefined

  const points: ScoreEvolutionPoint[] = chronological.map((pour, index) => {
    const isLast = index === chronological.length - 1
    let label: string
    if (index === 0) label = 'Neck Pour'
    else if (isLast && bottle.status === 'finished') label = 'Bottle Kill'
    else label = `Pour ${index + 1}`
    return { label, score: pour.rating, date: pour.date }
  })

  if (points.length <= PROGRESSION_FULL_LIMIT) return { points, truncated: false }
  return { points: [points[0]!, points[points.length - 1]!], truncated: true }
}

export interface FinishedDateInfo {
  date: string
  // true when this date is a best-effort derivation (last pour / opened /
  // added), not a value the user actually entered — see the fallback chain
  // below. Stays true until the user deliberately edits and saves a real
  // finishedDate; never auto-written back to the bottle.
  inferred: boolean
}

// Fallback order, display-only, never persisted: bottle.finishedDate (real,
// user-entered) -> latest real pour date (closest real signal to "when did
// this bottle actually run out") -> openedDate -> createdAt. Only meaningful
// once the bottle is actually finished.
export function getFinishedDate(bottle: Bottle, pours: Pour[]): FinishedDateInfo | undefined {
  if (bottle.status !== 'finished') return undefined
  if (bottle.finishedDate) return { date: bottle.finishedDate, inferred: false }

  const latestPour = getPoursForBottle(pours, bottle.id)[0]
  if (latestPour) return { date: latestPour.date, inferred: true }
  if (bottle.openedDate) return { date: bottle.openedDate, inferred: true }
  if (bottle.createdAt) return { date: new Date(bottle.createdAt).toISOString(), inferred: true }
  return undefined
}

export function getMemoriesForBottle(memories: Memory[], bottleId: string): Memory[] {
  return memories.filter((m) => m.bottleId === bottleId).sort((a, b) => a.date.localeCompare(b.date))
}

export type BottleStoryMilestone = 'First Pour' | 'Highest Rated' | 'Most Recent' | 'Shared Pour'

export interface BottleStoryEvent {
  id: string
  date: string
  label: string
  detail?: string
  pourId?: string
  bottleId?: string
  memoryId?: string
  photoUrl?: string
  tags?: BottleStoryMilestone[]
  inferredDate?: boolean
}

export interface BottleStory {
  events: BottleStoryEvent[]
  totalPourCount: number
  // true once routine pours have been curated out of `events` — the full
  // record is never hidden, just not repeated here (see Pour Stories tab).
  curated: boolean
}

// A pour keeps at most one "position in history" tag (First Pour beats
// Highest Rated beats Most Recent) so a single pour is never labeled twice
// for the same fact — e.g. a bottle's only pour is just "First Pour", never
// also "Highest Rated" and "Most Recent". Ties on Highest Rated resolve to
// the earliest occurrence. "Shared Pour" is a separate, independent fact
// (who was there, not when) so it can still appear alongside a positional
// tag without that being "stacking."
const LONG_HISTORY_POUR_THRESHOLD = 6

export function buildBottleStoryEvents(bottle: Bottle, pours: Pour[], memories: Memory[]): BottleStory {
  const chronological = [...getPoursForBottle(pours, bottle.id)].sort((a, b) => a.date.localeCompare(b.date))

  const firstId = chronological[0]?.id
  const mostRecentId = chronological[chronological.length - 1]?.id
  let highestId: string | undefined
  let highestRating = -Infinity
  for (const pour of chronological) {
    if (pour.rating > highestRating) {
      highestRating = pour.rating
      highestId = pour.id
    }
  }

  const curated = chronological.length > LONG_HISTORY_POUR_THRESHOLD
  const events: BottleStoryEvent[] = []

  if (bottle.createdAt) {
    events.push({ id: 'added', date: new Date(bottle.createdAt).toISOString(), label: 'Added to your bar' })
  }
  if (bottle.openedDate) {
    events.push({ id: 'opened', date: bottle.openedDate, label: 'Opened' })
  }

  for (const pour of chronological) {
    const tags: BottleStoryMilestone[] = []
    if (pour.id === firstId) tags.push('First Pour')
    else if (pour.id === highestId) tags.push('Highest Rated')
    else if (pour.id === mostRecentId) tags.push('Most Recent')

    // Curated (>6 pours) view keeps only pours that earned a positional
    // milestone — everything else stays in the Pour Stories tab, not hidden,
    // just not repeated here.
    if (curated && tags.length === 0) continue

    if (pour.companion?.trim()) tags.push('Shared Pour')

    events.push({
      id: `pour-${pour.id}`,
      date: pour.date,
      label: `Pour — ${pour.rating.toFixed(1)}`,
      detail: pour.memory?.trim() || pour.notes?.trim() || undefined,
      pourId: pour.id,
      bottleId: bottle.id,
      tags: tags.length > 0 ? tags : undefined,
    })
  }

  for (const memory of getMemoriesForBottle(memories, bottle.id)) {
    events.push({
      id: `memory-${memory.id}`,
      date: memory.date,
      label: memory.title,
      detail: memory.story,
      memoryId: memory.id,
      photoUrl: memory.photoUrl,
    })
  }

  const finished = getFinishedDate(bottle, pours)
  if (finished) {
    events.push({ id: 'finished', date: finished.date, label: 'Bottle Finished', inferredDate: finished.inferred })
  }

  events.sort((a, b) => a.date.localeCompare(b.date))

  return { events, totalPourCount: chronological.length, curated }
}
