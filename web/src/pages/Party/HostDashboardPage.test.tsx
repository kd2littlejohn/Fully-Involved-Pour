import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HostDashboardPage } from './HostDashboardPage'
import { makeCategory, makeParty } from '../../features/party/__fixtures__/party'
import type { Party } from '../../features/party/types'

const mockUseAuth = vi.fn()
const mockSetState = vi.fn()
let party: Party | undefined

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('../../features/party/usePartyData', () => ({
  useParty: () => ({ data: party, loading: false, error: party ? null : 'missing' }),
  usePartySecrets: () => ({
    data: { partyId: 'p1', hostUid: 'host-1', categories: { c1: { samples: [{ id: 's1', label: 'A', bottle: { name: 'Secret Weller', source: 'manual' } }] } } },
    loading: false,
    error: null,
  }),
  usePartyGuests: () => ({ data: [{ uid: 'g1', participantKey: 'k', nickname: 'Sam', joinedAt: 1, revoked: false }], loading: false, error: null }),
  usePartyResults: () => ({ data: {}, loading: false, error: null }),
}))
vi.mock('../../data/repositories/party', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/party')>()
  return { ...actual, setCategoryState: (...a: unknown[]) => mockSetState(...a) }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/party/p1/host']}>
      <Routes>
        <Route path="/party/:partyId/host" element={<HostDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HostDashboardPage', () => {
  beforeEach(() => {
    mockSetState.mockReset().mockResolvedValue({ state: 'ok' })
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    party = makeParty({ categories: [makeCategory({ state: 'voting_closed' })] })
  })

  it('refuses anyone but the host', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'someone-else' }, loading: false })
    renderPage()
    expect(screen.getByText('Hosts only')).toBeInTheDocument()
    expect(screen.queryByText('Secret Weller')).not.toBeInTheDocument()
  })

  it('shows guests, ballot counts, the join code and QR', () => {
    renderPage()
    expect(screen.getByText('Sam')).toBeInTheDocument()
    expect(screen.getByText('OAK 742')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /QR code to join Bourbon Night/ })).toBeInTheDocument()
    expect(screen.getByText(/2 digital · 1 paper ballots/)).toBeInTheDocument()
  })

  it('keeps the bottle mapping hidden until the host asks to see it', async () => {
    renderPage()
    expect(screen.queryByText('Secret Weller')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Show bottle mapping/ }))
    expect(screen.getByText('Secret Weller')).toBeInTheDocument()
  })

  it('requires confirmation before revealing, and never reveals on its own', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Reveal bottles' }))
    expect(mockSetState).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Reveal the bottles?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    await waitFor(() => expect(mockSetState).toHaveBeenCalledWith('p1', 'c1', 'revealed'))
  })

  it('closes voting without a confirmation and reports server errors', async () => {
    party = makeParty()
    mockSetState.mockRejectedValueOnce({ code: 'functions/failed-precondition', message: 'This round is voting closed and can’t move to voting closed.' })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Close voting' }))
    expect(mockSetState).toHaveBeenCalledWith('p1', 'c1', 'voting_closed')
    expect(await screen.findByRole('alert')).toHaveTextContent('can’t move')
  })

  it('offers "reveal all" instead of per-round reveal when revealing at the end', () => {
    party = makeParty({ settings: { ...makeParty().settings, revealByCategory: false }, categories: [makeCategory({ state: 'voting_closed' })] })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Reveal bottles' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reveal all closed rounds/ })).toBeInTheDocument()
  })
})
