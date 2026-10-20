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
vi.mock('../../features/party/usePartyData', () => ({
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
