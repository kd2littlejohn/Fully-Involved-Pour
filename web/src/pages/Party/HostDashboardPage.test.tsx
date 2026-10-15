import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HostDashboardPage } from './HostDashboardPage'
import { makeCategory, makeParty } from '../../features/party/__fixtures__/party'
import type { Party, PartyBallot, PartyGuest } from '../../features/party/types'

const mockUseAuth = vi.fn()
const mockSetState = vi.fn()
const mockSetHostTasting = vi.fn()
let party: Party | undefined
const SAM: PartyGuest = { uid: 'g1', participantKey: 'k', nickname: 'Sam', joinedAt: 1, revoked: false }
const HOST: PartyGuest = { uid: 'host-1', participantKey: 'h_1', nickname: 'Kevin', joinedAt: 0, revoked: false, isHost: true }
let guests: PartyGuest[] = [SAM]
let myBallots: PartyBallot[] = []

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('../../features/party/usePartyData', () => ({
  useParty: () => ({ data: party, loading: false, error: party ? null : 'missing' }),
  usePartySecrets: () => ({
    data: { partyId: 'p1', hostUid: 'host-1', categories: { c1: { samples: [{ id: 's1', label: 'A', bottle: { name: 'Secret Weller', source: 'manual' } }] } } },
    loading: false,
    error: null,
  }),
  usePartyGuests: () => ({ data: guests, loading: false, error: null }),
  usePartyResults: () => ({ data: {}, loading: false, error: null }),
  useMyBallots: (_p: string, _u: string, enabled: boolean) => ({ data: enabled ? myBallots : [], loading: false, error: null }),
}))
vi.mock('../../data/repositories/party', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/party')>()
  return {
    ...actual,
    setCategoryState: (...a: unknown[]) => mockSetState(...a),
    setHostTasting: (...a: unknown[]) => mockSetHostTasting(...a),
  }
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
    mockSetHostTasting.mockReset().mockResolvedValue({ ok: true })
    localStorage.clear()
    guests = [SAM]
    myBallots = []
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

  describe('when the host is tasting too', () => {
    beforeEach(() => {
      guests = [SAM, HOST]
      party = makeParty({ hostTasting: true })
    })

    function ballot(scores: PartyBallot['scores']): PartyBallot {
      return {
        id: 'c1__h_1', partyId: 'p1', categoryId: 'c1', participantKey: 'h_1', source: 'digital', ownerUid: 'host-1', mode: 'quick',
        scores, favoriteLabel: null, predictionLabel: null, excluded: false, createdAt: 1, updatedAt: 1, revision: 1,
      }
    }

    it('offers Manage Party and My Tasting, with personal progress on the tab', () => {
      myBallots = [ballot({ A: { overall: 7 }, B: { overall: 6 } })]
      renderPage()
      expect(screen.getByRole('tab', { name: /Manage Party/ })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: /My Tasting/ })).toHaveTextContent('2 of 3 samples scored')
      // The host isn't counted or listed as a guest.
      expect(screen.getByRole('tab', { name: /Manage Party/ })).toHaveTextContent('1 guest')
      expect(screen.queryByRole('button', { name: 'Remove Kevin' })).not.toBeInTheDocument()
    })

    it('says so clearly when personal scoring is complete', () => {
      myBallots = [ballot({ A: { overall: 7 }, B: { overall: 6 }, C: { overall: 8 } })]
      renderPage()
      expect(screen.getByRole('tab', { name: /My Tasting/ })).toHaveTextContent('All samples scored ✓')
    })

    it('switches with one tap, keeps admin controls out of My Tasting, and stays blind', async () => {
      renderPage()
      await userEvent.click(screen.getByRole('tab', { name: /My Tasting/ }))
      const tasting = screen.getByRole('tabpanel', { name: /My Tasting/ })
      expect(within(tasting).getByRole('heading', { name: 'Sample A' })).toBeInTheDocument()
      expect(within(tasting).queryByRole('button', { name: 'Close voting' })).not.toBeInTheDocument()
      expect(within(tasting).queryByText('Secret Weller')).not.toBeInTheDocument()
      // Hidden, not just covered: out of the accessibility tree too.
      expect(screen.queryByRole('button', { name: 'Close voting' })).toBeNull()

      await userEvent.click(screen.getByRole('tab', { name: /Manage Party/ }))
      expect(screen.getByRole('button', { name: 'Close voting' })).toBeVisible()
    })

    it('keeps unsaved scores when switching to Manage Party and back', async () => {
      renderPage()
      await userEvent.click(screen.getByRole('tab', { name: /My Tasting/ }))
      fireEvent.change(screen.getByLabelText('Overall enjoyment', { selector: '#overall-B' }), { target: { value: '8.5' } })
      await userEvent.click(screen.getByRole('tab', { name: /Manage Party/ }))
      await userEvent.click(screen.getByRole('tab', { name: /My Tasting/ }))
      expect(screen.getByLabelText('Overall enjoyment', { selector: '#overall-B' })).toHaveValue('8.5')
    })

    it('reopens on My Tasting, with the draft, after leaving the dashboard', async () => {
      const first = renderPage()
      await userEvent.click(screen.getByRole('tab', { name: /My Tasting/ }))
      fireEvent.change(screen.getByLabelText('Overall enjoyment', { selector: '#overall-C' }), { target: { value: '6' } })
      first.unmount()

      renderPage()
      expect(screen.getByRole('tab', { name: /My Tasting/ })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Overall enjoyment', { selector: '#overall-C' })).toHaveValue('6')
    })

    it('asks before the host stops tasting, and keeps host controls', async () => {
      renderPage()
      await userEvent.click(screen.getByRole('button', { name: 'Stop tasting' }))
      expect(screen.getByRole('heading', { name: 'Stop tasting?' })).toBeInTheDocument()
      await userEvent.click(within(screen.getByRole('dialog', { hidden: true })).getByRole('button', { name: 'Stop tasting', hidden: true }))
      await waitFor(() => expect(mockSetHostTasting).toHaveBeenCalledWith('p1', false))
    })
  })

  it('without host tasting there is no My Tasting, just a way to turn it on', async () => {
    party = makeParty({ hostTasting: false })
    renderPage()
    expect(screen.queryByRole('tab', { name: /My Tasting/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'I’m tasting too' }))
    await waitFor(() => expect(mockSetHostTasting).toHaveBeenCalledWith('p1', true))
  })
})
