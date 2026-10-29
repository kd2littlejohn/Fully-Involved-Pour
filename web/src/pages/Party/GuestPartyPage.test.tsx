import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuestPartyPage } from './GuestPartyPage'
import { makeCategory, makeParty, makeResults } from '../../features/party/__fixtures__/party'
import type { Party, PartyCategoryResults, PartyGuest, PartyRosterEntry } from '../../features/party/types'

let user: { uid: string; isAnonymous: boolean } | null
let guest: PartyGuest | undefined
let party: Party | undefined
let results: Record<string, PartyCategoryResults>
let roster: PartyRosterEntry[]
const mockUsePartyRoster = vi.fn()

vi.mock('../../features/party/useGuestIdentity', () => ({
  useGuestIdentity: () => ({ user, loading: false, ensureIdentity: vi.fn() }),
}))
const mockUseGuidedBottles = vi.fn()
let guidedData: Record<string, Record<string, { name: string }>> = {}
vi.mock('../../features/party/usePartyData', () => ({
  useGuidedBottles: (...a: unknown[]) => {
    mockUseGuidedBottles(...a)
    return { data: a[1] ? guidedData : {}, loading: false, error: null }
  },
  useMyGuest: () => ({ data: guest, loading: false, error: null }),
  useParty: () => ({ data: party, loading: false, error: null }),
  useMyBallots: () => ({ data: [], loading: false, error: null }),
  usePartyResults: () => ({ data: results, loading: false, error: null }),
  usePartyRoster: (...a: unknown[]) => {
    mockUsePartyRoster(...a)
    return { data: roster, loading: false, error: null }
  },
}))
vi.mock('../../features/party/ScoringPanel', () => ({ ScoringPanel: () => <div>scoring-panel</div> }))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/party/p1']}>
      <Routes>
        <Route path="/party/:partyId" element={<GuestPartyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('GuestPartyPage', () => {
  beforeEach(() => {
    localStorage.clear()
    user = { uid: 'anon-1', isAnonymous: true }
    guest = { uid: 'anon-1', participantKey: 'g_me', nickname: 'Kev', joinedAt: 1, revoked: false }
    party = makeParty()
    results = {}
    roster = [
      { id: 'host', name: 'Kevin', role: 'host', tasting: true, joinedAt: 0, progress: { c1: 'submitted' } },
      { id: 'g_me', name: 'Kev', role: 'guest', tasting: true, joinedAt: 1, progress: { c1: 'tasting' } },
      { id: 'g_2', name: 'Richy', role: 'guest', tasting: true, joinedAt: 2, progress: {} },
      { id: 'c_x', name: 'Pat', role: 'cohost', tasting: false, joinedAt: 0, progress: {} },
    ]
    mockUsePartyRoster.mockReset()
  })

  it('asks a visitor who hasn’t joined to join first', () => {
    guest = undefined
    renderPage()
    expect(screen.getByText('Join to taste along')).toBeInTheDocument()
  })

  it('tells a removed guest they no longer have access', () => {
    guest = { ...guest!, revoked: true }
    renderPage()
    expect(screen.getByText('You’ve left this party')).toBeInTheDocument()
  })

  it('shows the scoring panel while voting is open', () => {
    renderPage()
    expect(screen.getByText('Hi, Kev')).toBeInTheDocument()
    expect(screen.getByText('scoring-panel')).toBeInTheDocument()
  })

  it('waits for the host when voting is closed — no bottle names', () => {
    party = makeParty({ categories: [makeCategory({ state: 'voting_closed' })] })
    renderPage()
    expect(screen.getByText(/The reveal is up to your host/)).toBeInTheDocument()
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()
  })

  it('shows results after reveal, plus the optional account offer for anonymous guests', () => {
    party = makeParty({ categories: [makeCategory({ state: 'revealed' })] })
    results = { c1: makeResults() }
    renderPage()
    expect(screen.getAllByText('Weller 12').length).toBeGreaterThan(0)
    expect(screen.getByText('Enjoyed the experience?')).toBeInTheDocument()
  })

  it('never pushes account creation on signed-in FIP users', () => {
    user = { uid: 'anon-1', isAnonymous: false }
    party = makeParty({ categories: [makeCategory({ state: 'revealed' })] })
    results = { c1: makeResults() }
    renderPage()
    expect(screen.queryByText('Enjoyed the experience?')).not.toBeInTheDocument()
  })

  it('shows every guest, anonymous ones included, who is tasting — read-only, with roles and status', () => {
    renderPage()
    const section = screen.getByRole('region', { name: 'Who’s Tasting' })
    expect(within(section).getByText('3 participants')).toBeInTheDocument()
    const tasting = within(section).getByRole('list', { name: 'Who’s Tasting' })
    const rows = within(tasting).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/Kevin.*Host.*Submitted/),
      expect.stringMatching(/Kev \(You\).*Guest.*Tasting/),
      expect.stringMatching(/Richy.*Guest.*Joined/),
    ])
    expect(within(section).getByRole('list', { name: 'Hosting, not tasting' })).toHaveTextContent(/Pat.*Co-host/)
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
    expect(mockUsePartyRoster).toHaveBeenCalledWith('p1', true)
  })

  it('opens the list from the "Tasting" chip without leaving the scoring screen', async () => {
    renderPage()
    expect(screen.getByText('scoring-panel')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /3 Tasting/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Richy')).toBeInTheDocument()
    expect(screen.getByText('scoring-panel')).toBeInTheDocument()
  })

  it('does not subscribe to the roster for a removed guest', () => {
    guest = { ...guest!, revoked: true }
    renderPage()
    expect(mockUsePartyRoster).not.toHaveBeenCalledWith('p1', true)
  })
})

describe('GuestPartyPage in a Dual Experience party', () => {
  beforeEach(() => {
    localStorage.clear()
    user = { uid: 'anon-1', isAnonymous: true }
    party = makeParty({ format: 'dual', dual: { joinGroup: 'blind', plannedGuided: 7, plannedBlind: 3 } })
    results = {}
    guidedData = { c1: { A: { name: 'Castle & Key Wheated' }, B: { name: 'Weller Antique 107' }, C: { name: 'Redwood Empire Wheated' } } }
    roster = [
      { id: 'host', name: 'Kevin', role: 'host', tasting: true, joinedAt: 0, progress: {}, group: 'guided' },
      { id: 'g_me', name: 'Kev', role: 'guest', tasting: true, joinedAt: 1, progress: {}, group: 'guided' },
      { id: 'g_2', name: 'Richy', role: 'guest', tasting: true, joinedAt: 2, progress: {}, group: 'blind' },
    ]
    mockUseGuidedBottles.mockReset()
  })

  it('shows a guided guest their group and the bottles, from the guided view only', () => {
    guest = { uid: 'anon-1', participantKey: 'g_me', nickname: 'Kev', joinedAt: 1, revoked: false, group: 'guided' }
    renderPage()
    expect(mockUseGuidedBottles).toHaveBeenLastCalledWith('p1', true)
    expect(screen.getByText('Guided tasting')).toBeInTheDocument()
    expect(screen.getByText(/A\. Castle & Key Wheated · B\. Weller Antique 107/)).toBeInTheDocument()
  })

  it('never subscribes a blind guest to the guided bottles or shows a bottle name', () => {
    guest = { uid: 'anon-2', participantKey: 'g_2', nickname: 'Richy', joinedAt: 2, revoked: false, group: 'blind' }
    renderPage()
    expect(mockUseGuidedBottles).toHaveBeenLastCalledWith('p1', false)
    expect(mockUseGuidedBottles).not.toHaveBeenCalledWith('p1', true)
    expect(screen.getByText('Blind tasting')).toBeInTheDocument()
    expect(screen.getByText(/3 samples: A, B, C/)).toBeInTheDocument()
    expect(screen.queryByText(/Weller/)).not.toBeInTheDocument()
  })

  it('treats a guest without a group as blind', () => {
    guest = { uid: 'anon-3', participantKey: 'g_3', nickname: 'Fay', joinedAt: 3, revoked: false }
    renderPage()
    expect(mockUseGuidedBottles).not.toHaveBeenCalledWith('p1', true)
    expect(screen.getByText('Blind tasting')).toBeInTheDocument()
  })

  it('lists Who’s Tasting by group for everyone', () => {
    guest = { uid: 'anon-2', participantKey: 'g_2', nickname: 'Richy', joinedAt: 2, revoked: false, group: 'blind' }
    renderPage()
    const card = screen.getByRole('heading', { name: 'Who’s Tasting' }).closest('section')!
    expect(within(card).getByText('Guided — 2')).toBeInTheDocument()
    expect(within(card).getByText('Blind — 1')).toBeInTheDocument()
    expect(within(card).getByRole('list', { name: 'Blind — 1' })).toHaveTextContent('Richy')
  })

  it('shows a round’s pairing only after the taster has scored every sample', () => {
    guest = { uid: 'anon-2', participantKey: 'g_2', nickname: 'Richy', joinedAt: 2, revoked: false, group: 'blind' }
    party = makeParty({ format: 'dual', extras: { stations: [{ name: 'Oak', description: 'Toasted staves', guidance: '' }], pairings: { c1: { name: 'Milk chocolate caramel candy', note: '' } } } })
    renderPage()
    expect(screen.queryByText('Milk chocolate caramel candy')).not.toBeInTheDocument()
    expect(screen.getByText('Aroma stations')).toBeInTheDocument()
  })
})
