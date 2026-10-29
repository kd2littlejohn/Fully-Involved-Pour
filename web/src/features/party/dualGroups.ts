// Dual Experience helpers: group labels and per-group progress, all from
// data every member may already read (the party doc and the public
// roster). Pure, so the counting rules are tested directly.
import { partyFormat, type Party, type PartyGroup, type PartyGuest, type PartyRosterEntry } from './types'

export const GROUPS: PartyGroup[] = ['guided', 'blind']

export const GROUP_LABEL: Record<PartyGroup, string> = { guided: 'Guided', blind: 'Blind' }

export const GROUP_HINT: Record<PartyGroup, string> = {
  guided: 'Sees each bottle while scoring, with notes to learn from.',
  blind: 'Sees only Sample A, B, C… until the reveal.',
}

export function isDual(party: Pick<Party, 'format'>): boolean {
  return partyFormat(party) === 'dual'
}

// A taster's group, the way the server reads it: a guest without one is
// blind; a host without one is guided.
export function guestGroup(party: Pick<Party, 'format'>, guest: Pick<PartyGuest, 'group' | 'isHost'> | undefined): PartyGroup | null {
  if (!guest || !isDual(party)) return null
  if (guest.group === 'guided' || guest.group === 'blind') return guest.group
  return guest.isHost ? 'guided' : 'blind'
}

export function rosterGroup(entry: Pick<PartyRosterEntry, 'group' | 'role'>): PartyGroup {
  if (entry.group === 'guided' || entry.group === 'blind') return entry.group
  return entry.role === 'host' ? 'guided' : 'blind'
}

export interface GroupProgress {
  // Tasters in the group (host included when tasting; co-hosts never).
  total: number
  // How many have finished this round's ballot.
  submitted: number
  // Started but not finished.
  tasting: number
}

// "Guided: 5 of 7 submitted · Blind: 2 of 3 submitted" for one round.
export function groupProgress(entries: PartyRosterEntry[], categoryId: string | null): Record<PartyGroup, GroupProgress> {
  const out: Record<PartyGroup, GroupProgress> = { guided: { total: 0, submitted: 0, tasting: 0 }, blind: { total: 0, submitted: 0, tasting: 0 } }
  for (const entry of entries) {
    if (!entry.tasting || entry.role === 'cohost') continue
    const group = out[rosterGroup(entry)]
    group.total += 1
    const status = categoryId ? entry.progress?.[categoryId] : undefined
    if (status === 'submitted') group.submitted += 1
    else if (status === 'tasting') group.tasting += 1
  }
  return out
}

export function groupCounts(entries: PartyRosterEntry[]): Record<PartyGroup, number> {
  const progress = groupProgress(entries, null)
  return { guided: progress.guided.total, blind: progress.blind.total }
}
