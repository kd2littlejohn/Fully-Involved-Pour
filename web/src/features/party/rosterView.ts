// Shapes the public roster for the "Who's Tasting" list: who's counted,
// in what order, with what status. Pure, so the counting rules are tested
// directly (rosterView.test.ts).
import type { Party, PartyRosterEntry, PartyRosterRole } from './types'

export type RosterStatus = 'Joined' | 'Tasting' | 'Submitted'

export interface RosterRow {
  id: string
  name: string
  role: PartyRosterRole
  roleLabel: string
  // Null for people who aren't tasting (co-hosts, a host who isn't scoring).
  status: RosterStatus | null
  isMe: boolean
  initial: string
}

export interface RosterView {
  // Everyone scoring: the host when tasting, plus guests. This is the count.
  tasting: RosterRow[]
  // Running the party without scoring: co-hosts, a non-tasting host.
  hosting: RosterRow[]
  count: number
}

const ROLE_LABEL: Record<PartyRosterRole, string> = { host: 'Host', cohost: 'Co-host', guest: 'Guest' }
const ROLE_ORDER: Record<PartyRosterRole, number> = { host: 0, cohost: 1, guest: 2 }

// The round whose progress a status reflects: the one open for voting.
// Nothing open means nobody is mid-round, so tasters show as Joined.
function openCategoryId(party: Party): string | null {
  if (party.status === 'completed') return null
  const open = party.categories.filter((c) => c.state === 'voting_open')
  if (!open.length) return null
  return (open.find((c) => c.id === party.currentCategoryId) ?? open[0]!).id
}

export function rosterStatus(entry: PartyRosterEntry, openId: string | null): RosterStatus | null {
  if (!entry.tasting) return null
  const progress = openId ? entry.progress?.[openId] : undefined
  if (progress === 'submitted') return 'Submitted'
  if (progress === 'tasting') return 'Tasting'
  return 'Joined'
}

export function buildRosterView(party: Party, entries: PartyRosterEntry[], myRosterId: string | null): RosterView {
  const openId = openCategoryId(party)
  const rows = [...entries]
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt - b.joinedAt || a.name.localeCompare(b.name))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      role: entry.role,
      roleLabel: ROLE_LABEL[entry.role] ?? 'Guest',
      status: rosterStatus(entry, openId),
      isMe: entry.id === myRosterId,
      initial: (entry.name.trim()[0] ?? '?').toUpperCase(),
      tasting: entry.tasting && entry.role !== 'cohost',
    }))
  const tasting = rows.filter((r) => r.tasting).map(({ tasting: _t, ...row }) => row)
  const hosting = rows.filter((r) => !r.tasting).map(({ tasting: _t, ...row }) => row)
  return { tasting, hosting, count: tasting.length }
}

export function tastingCountLabel(count: number): string {
  return `${count} Tasting`
}

// A co-host's roster id is a one-way hash of the party and their uid, the
// same as the server's (functions/party/roster.js coHostRosterId), so they
// can be marked "(You)" without the roster ever holding a uid.
export async function coHostRosterId(partyId: string, uid: string): Promise<string> {
  const data = new TextEncoder().encode(`${partyId}:${uid}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `c_${hex.slice(0, 20)}`
}
