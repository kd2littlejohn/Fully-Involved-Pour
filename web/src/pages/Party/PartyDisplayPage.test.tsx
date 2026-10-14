import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PartyDisplayPage } from './PartyDisplayPage'
import { makeCategory, makeParty, makeResults } from '../../features/party/__fixtures__/party'
import type { Party, PartyCategoryResults } from '../../features/party/types'

const mockRedeem = vi.fn()
const mockEnsure = vi.fn()
let party: Party | undefined
let results: Record<string, PartyCategoryResults>

vi.mock('../../features/party/useGuestIdentity', () => ({
  useGuestIdentity: () => ({ user: { uid: 'tv' }, loading: false, ensureIdentity: mockEnsure }),
}))
vi.mock('../../features/party/usePartyData', () => ({
  useParty: () => ({ data: party, loading: false, error: null }),
  usePartyResults: () => ({ data: results, loading: false, error: null }),
  usePartyRecap: () => ({ data: undefined, loading: false, error: null }),
}))
vi.mock('../../data/repositories/party', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/party')>()
  return { ...actual, redeemDisplay: (...a: unknown[]) => mockRedeem(...a) }
})

function renderAt(path = '/party/p1/display?t=secret-token') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/party/:partyId/display" element={<PartyDisplayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PartyDisplayPage', () => {
  beforeEach(() => {
    mockRedeem.mockReset().mockResolvedValue({ partyId: 'p1', expiresAt: Date.now() + 1000 })
    mockEnsure.mockReset().mockResolvedValue({ uid: 'tv' })
    party = makeParty()
    results = {}
  })

  it('redeems the host’s display token with an anonymous identity', async () => {
    renderAt()
    await waitFor(() => expect(mockRedeem).toHaveBeenCalledWith('p1', 'secret-token'))
    expect(mockEnsure).toHaveBeenCalled()
  })

  it('shows the round, letters, ballot count and join QR — never bottle names before reveal', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Wheated Bourbon' })).toBeInTheDocument()
    expect(screen.getByText('ballots in').previousElementSibling).toHaveTextContent('3')
    expect(screen.getByRole('img', { name: /QR code to join/ })).toBeInTheDocument()
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()
  })

  it('shows rankings once the host has revealed', async () => {
    party = makeParty({ categories: [makeCategory({ state: 'revealed' })] })
    results = { c1: makeResults() }
    renderAt()
    expect((await screen.findAllByText('Weller 12')).length).toBeGreaterThan(0)
  })

  it('tells a display with a stale link to get a new one', async () => {
    mockRedeem.mockRejectedValue({ code: 'functions/permission-denied', message: 'This display link has expired.' })
    renderAt()
    expect(await screen.findByText('This display link has expired.')).toBeInTheDocument()
  })
})
