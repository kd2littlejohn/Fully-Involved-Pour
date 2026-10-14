import type { Party, PartyCategory, PartyCategoryState } from './types'

export function categoryStateLabel(state: PartyCategoryState): string {
  switch (state) {
    case 'draft':
      return 'Draft'
    case 'ready':
      return 'Ready'
    case 'voting_open':
      return 'Voting open'
    case 'voting_closed':
      return 'Voting closed'
    case 'revealed':
      return 'Revealed'
  }
}

export function partyStatusLabel(party: Pick<Party, 'status'>): string {
  switch (party.status) {
    case 'setup':
      return 'Setting up'
    case 'live':
      return 'Live'
    case 'completed':
      return 'Wrapped up'
  }
}

export function formatEventDate(eventDate: string | null | undefined): string | null {
  if (!eventDate) return null
  const [datePart, timePart] = eventDate.split('T')
  const [y, m, d] = (datePart ?? '').split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  if (!timePart) return day
  const [hh, mm] = timePart.split(':').map(Number)
  const time = new Date(y, m - 1, d, hh ?? 0, mm ?? 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

export function ballotCount(party: Party, categoryId: string): { digital: number; paper: number; total: number } {
  const digital = party.counts?.digital?.[categoryId] ?? 0
  const paper = party.counts?.paper?.[categoryId] ?? 0
  return { digital, paper, total: digital + paper }
}

// The round guests should be looking at: whatever is open for voting, else
// the host's current round, else the first.
export function activeCategory(party: Party): PartyCategory | undefined {
  return (
    party.categories.find((c) => c.state === 'voting_open') ??
    party.categories.find((c) => c.id === party.currentCategoryId) ??
    party.categories[0]
  )
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(value * 10 === Math.round(value * 10) ? 1 : 2)
}

export function ordinal(rank: number): string {
  const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[rank % 10] ?? 'th'
  return `${rank}${suffix}`
}
