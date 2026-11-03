// Synchronized tasting on the client: reading where the room is
// (party.progress, written only by the server's setProgress) and working
// out glass numbers and which host controls apply right now. Pure.
import type { Party, PartyCategory, PartyProgress, PartyProgressCommand, PartyRosterEntry } from './types'

export function progressOf(party: Pick<Party, 'progress' | 'status'>): PartyProgress {
  const p = party.progress
  return {
    state: p?.state ?? (party.status === 'completed' ? 'ended' : 'lobby'),
    categoryId: p?.categoryId ?? null,
    label: p?.label ?? null,
    seq: p?.seq ?? 0,
    updatedAt: p?.updatedAt ?? null,
    updatedBy: p?.updatedBy ?? null,
  }
}

export function totalGlasses(party: Pick<Party, 'categories'>): number {
  return party.categories.reduce((sum, c) => sum + c.sampleLabels.length, 0)
}

// Glass number across the whole event (Flight 2, glass A = glass 4 of 9).
// Letters only, so it reveals nothing about a bottle.
export function glassNumber(party: Pick<Party, 'categories'>, categoryId: string | null, label: string | null): number | null {
  if (!categoryId || !label) return null
  let n = 0
  for (const c of party.categories) {
    if (c.id === categoryId) {
      const at = c.sampleLabels.indexOf(label)
      return at < 0 ? null : n + at + 1
    }
    n += c.sampleLabels.length
  }
  return null
}

export function flightIndex(party: Pick<Party, 'categories'>, categoryId: string | null): number {
  return categoryId ? party.categories.findIndex((c) => c.id === categoryId) : -1
}

export interface LiveControlState {
  progress: PartyProgress
  current: PartyCategory | null
  nextGlass: string | null
  nextFlight: PartyCategory | null
  allowed: Record<PartyProgressCommand, boolean>
  canLock: boolean
  canReveal: boolean
}

export function liveControls(party: Party): LiveControlState {
  const progress = progressOf(party)
  const index = flightIndex(party, progress.categoryId)
  const current = index >= 0 ? party.categories[index]! : null
  const at = current && progress.label ? current.sampleLabels.indexOf(progress.label) : -1
  const nextGlass = current && at >= 0 ? (current.sampleLabels[at + 1] ?? null) : null
  const nextFlight = index >= 0 ? (party.categories[index + 1] ?? null) : null
  const running = progress.state === 'live' || progress.state === 'paused'
  const done = party.status === 'completed'
  const first = party.categories[0]
  return {
    progress,
    current,
    nextGlass,
    nextFlight,
    allowed: {
      start: !done && progress.state === 'lobby' && Boolean(first && first.sampleLabels.length >= 2),
      openGlass: !done && running,
      pause: !done && progress.state === 'live',
      resume: !done && progress.state === 'paused',
      advanceGlass: !done && running && Boolean(nextGlass),
      advanceFlight: !done && running && Boolean(nextFlight),
    },
    canLock: !done && current?.state === 'voting_open',
    canReveal: !done && party.categories.some((c) => c.state === 'voting_closed'),
  }
}

export const PROGRESS_LABEL: Record<PartyProgress['state'], string> = {
  lobby: 'In the lobby',
  live: 'Live',
  paused: 'Paused',
  ended: 'Ended',
}

// Submission progress for one flight, from the shared roster: counts of
// who is tasting / submitted, never a score.
export function flightSubmissions(entries: PartyRosterEntry[], categoryId: string) {
  const tasters = entries.filter((e) => e.tasting)
  const tally = (list: PartyRosterEntry[]) => ({
    total: list.length,
    submitted: list.filter((e) => e.progress?.[categoryId] === 'submitted').length,
    started: list.filter((e) => e.progress?.[categoryId] === 'tasting').length,
  })
  return {
    all: tally(tasters),
    guided: tally(tasters.filter((e) => e.group === 'guided')),
    blind: tally(tasters.filter((e) => e.group !== 'guided')),
  }
}
