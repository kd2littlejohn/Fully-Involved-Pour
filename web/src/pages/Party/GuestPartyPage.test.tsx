import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuestPartyPage } from './GuestPartyPage'
import { makeCategory, makeParty, makeResults } from '../../features/party/__fixtures__/party'
import type { Party, PartyCategoryResults, PartyGuest } from '../../features/party/types'

let user: { uid: string; isAnonymous: boolean } | null
let guest: PartyGuest | undefined
let party: Party | undefined
let results: Record<string, PartyCategoryResults>

vi.mock('../../features/party/useGuestIdentity', () => ({
  useGuestIdentity: () => ({ user, loading: false, ensureIdentity: vi.fn() }),
}))
vi.mock('../../features/party/usePartyData', () => ({
  useMyGuest: () => ({ data: guest, loading: false, error: null }),
  useParty: () => ({ data: party, loading: false, error: null }),
  useMyBallots: () => ({ data: [], loading: false, error: null }),
  usePartyResults: () => ({ data: results, loading: false, error: null }),
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
})
