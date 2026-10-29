import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HostDashboardPage } from './HostDashboardPage'
import { makeCategory, makeParty } from '../../features/party/__fixtures__/party'
import type { Party, PartyAdmin, PartyBallot, PartyGuest, PartyRosterEntry } from '../../features/party/types'

const mockUseAuth = vi.fn()
const mockSetState = vi.fn()
const mockSetHostTasting = vi.fn()
const mockGetBottleKey = vi.fn()
const mockGetKeyAccessLog = vi.fn()
const mockCreateCoHostInvite = vi.fn()
const mockRemoveCoHost = vi.fn()
const mockAssignGroup = vi.fn()
let party: Party | undefined
const SAM: PartyGuest = { uid: 'g1', participantKey: 'k', nickname: 'Sam', joinedAt: 1, revoked: false }
const HOST: PartyGuest = { uid: 'host-1', participantKey: 'h_1', nickname: 'Kevin', joinedAt: 0, revoked: false, isHost: true }
let guests: PartyGuest[] = [SAM]
let myBallots: PartyBallot[] = []
const ROSTER_HOST: PartyRosterEntry = { id: 'host', name: 'Kevin', role: 'host', tasting: true, joinedAt: 0, progress: {} }
const ROSTER_SAM: PartyRosterEntry = { id: 'k', name: 'Sam', role: 'guest', tasting: true, joinedAt: 1, progress: {} }
let roster: PartyRosterEntry[] = [ROSTER_HOST, ROSTER_SAM]
// Roles come from the protected admin records, never the party document.
const HOST_ADMIN: PartyAdmin = { uid: 'host-1', role: 'host', name: 'Kevin', addedAt: 0 }
const PAT_ADMIN: PartyAdmin = { uid: 'co-1', role: 'cohost', name: 'Pat', addedAt: 1 }
let admins: PartyAdmin[] = [HOST_ADMIN]
const mockSyncRoster = vi.fn()

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
const mockUseGuidedBottles = vi.fn()
vi.mock('../../features/party/usePartyData', () => ({
  useGuidedBottles: (...a: unknown[]) => {
    mockUseGuidedBottles(...a)
    return { data: {}, loading: false, error: null }
  },
  useParty: () => ({ data: party, loading: false, error: party ? null : 'missing' }),
  usePartyGuests: () => ({ data: guests, loading: false, error: null }),
  usePartyResults: () => ({ data: {}, loading: false, error: null }),
  usePartyRoster: () => ({ data: roster, loading: false, error: null }),
  useMyAdminRole: (_p: string, uid?: string) => ({ role: admins.find((a) => a.uid === uid)?.role ?? null, loading: false }),
  usePartyAdmins: (_p: string, enabled: boolean) => ({ data: enabled ? admins : [], loading: false, error: null }),
  useMyBallots: (_p: string, _u: string, enabled: boolean) => ({ data: enabled ? myBallots : [], loading: false, error: null }),
}))
vi.mock('../../data/repositories/party', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/party')>()
  return {
    ...actual,
    setCategoryState: (...a: unknown[]) => mockSetState(...a),
    setHostTasting: (...a: unknown[]) => mockSetHostTasting(...a),
    getBottleKey: (...a: unknown[]) => mockGetBottleKey(...a),
    getKeyAccessLog: (...a: unknown[]) => mockGetKeyAccessLog(...a),
    createCoHostInvite: (...a: unknown[]) => mockCreateCoHostInvite(...a),
    removeCoHost: (...a: unknown[]) => mockRemoveCoHost(...a),
    assignPartyGroup: (...a: unknown[]) => mockAssignGroup(...a),
    syncRoster: (...a: unknown[]) => mockSyncRoster(...a),
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
    roster = [ROSTER_HOST, ROSTER_SAM]
    admins = [HOST_ADMIN]
    mockSyncRoster.mockReset().mockResolvedValue({ count: 2 })
    mockSetState.mockReset().mockResolvedValue({ state: 'ok' })
    mockSetHostTasting.mockReset().mockResolvedValue({ ok: true })
    mockGetBottleKey.mockReset().mockResolvedValue({
      categories: { c1: { samples: [{ id: 's1', label: 'A', bottle: { name: 'Secret Weller', source: 'manual' } }] } },
      flaggedCategoryIds: [],
    })
    mockGetKeyAccessLog.mockReset().mockResolvedValue([])
    mockCreateCoHostInvite.mockReset().mockResolvedValue({ token: 'TOKEN123', expiresAt: 1 })
    mockRemoveCoHost.mockReset().mockResolvedValue({ ok: true })
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
    expect(within(screen.getByRole('region', { name: 'Participants' })).getByText('Sam')).toBeInTheDocument()
    expect(screen.getByText('OAK 742')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /QR code to join Bourbon Night/ })).toBeInTheDocument()
    expect(screen.getByText(/2 digital · 1 paper ballots/)).toBeInTheDocument()
  })

  it('never loads the bottle key until an admin confirms, then shows it in the round', async () => {
    renderPage()
    expect(mockGetBottleKey).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Show bottle key' }))
    expect(screen.getByRole('heading', { name: 'Show the bottle key?' })).toBeInTheDocument()
    expect(mockGetBottleKey).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getByRole('dialog', { hidden: true })).getByRole('button', { name: 'Show bottle key', hidden: true }))
    expect(await screen.findByText('Secret Weller')).toBeInTheDocument()
    expect(mockGetBottleKey).toHaveBeenCalledWith('p1')
    // Hiding drops it from memory: showing again asks again.
    await userEvent.click(screen.getByRole('button', { name: 'Hide key' }))
    expect(screen.queryByText('Secret Weller')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show bottle key' }))
    expect(screen.getByRole('heading', { name: 'Show the bottle key?' })).toBeInTheDocument()
  })

  it('cancelling the confirmation never fetches the key', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'View bottle key' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }))
    expect(mockGetBottleKey).not.toHaveBeenCalled()
  })

  it('lists who viewed the key before the reveal', async () => {
    admins = [HOST_ADMIN, PAT_ADMIN]
    mockGetKeyAccessLog.mockResolvedValue([
      { id: 'a1', actorUid: 'co-1', role: 'cohost', purpose: 'setup', at: 2, flaggedCategoryIds: [] },
      { id: 'a2', actorUid: 'host-1', role: 'host', purpose: 'key', at: 1, flaggedCategoryIds: ['c1'] },
    ])
    renderPage()
    const log = await screen.findByRole('list', { name: 'Bottle key access before reveal' })
    expect(log).toHaveTextContent('Pat (co-host) · editing setup')
    expect(log).toHaveTextContent('Kevin (host) · viewed key · tasting marked not fully blind')
  })

  it('invites a co-host with a one-time link', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Invite a co-host' }))
    await waitFor(() => expect(mockCreateCoHostInvite).toHaveBeenCalledWith('p1'))
    expect((await screen.findByLabelText('Co-host invite link') as HTMLInputElement).value).toContain('#/party/p1/cohost?t=TOKEN123')
  })

  it('a co-host runs the event but gets no My Tasting, delete, co-host or host-tasting controls', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'co-1' }, loading: false })
    guests = [SAM, HOST]
    admins = [HOST_ADMIN, PAT_ADMIN]
    party = makeParty({ hostTasting: true })
    renderPage()
    expect(screen.getByRole('button', { name: 'Close voting' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /My Tasting/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete party' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invite a co-host' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop tasting' })).not.toBeInTheDocument()
    expect(screen.getByText(/You’re a co-host/)).toBeInTheDocument()
    expect(screen.getByText(/Kevin \(host\) · tasting too/)).toBeInTheDocument()
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

    it('tells the tasting host which rounds are marked not fully blind', () => {
      party = makeParty({ hostTasting: true, hostKeyViews: { c1: 5 } })
      renderPage()
      expect(screen.getByRole('note')).toHaveTextContent('“Wheated Bourbon” are marked not fully blind')
    })

    it('warns a tasting host before showing the key', async () => {
      renderPage()
      await userEvent.click(screen.getByRole('button', { name: 'View bottle key' }))
      expect(screen.getByRole('dialog', { hidden: true })).toHaveTextContent('marks your scores as not fully blind')
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

  it('regular tastings close voting straight to results, after a confirmation', async () => {
    party = makeParty({ format: 'regular', categories: [makeCategory({ state: 'voting_open' })] })
    renderPage()
    expect(screen.getByText(/Regular tasting/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close voting' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close voting & show results' }))
    expect(mockSetState).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Show results' }))
    await waitFor(() => expect(mockSetState).toHaveBeenCalledWith('p1', 'c1', 'revealed'))
  })

  it('shows the shared Who’s Tasting list, with management kept in a separate Participants section', () => {
    renderPage()
    const shared = screen.getByRole('region', { name: 'Who’s Tasting' })
    expect(within(shared).getByText('2 participants')).toBeInTheDocument()
    expect(within(shared).getByText(/Kevin/).closest('li')).toHaveTextContent('(You)')
    expect(within(shared).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    const manage = screen.getByRole('region', { name: 'Participants' })
    expect(within(manage).getByRole('button', { name: 'Remove Sam' })).toBeInTheDocument()
    expect(mockSyncRoster).not.toHaveBeenCalled()
  })

  it('builds the roster once for a party created before it existed', async () => {
    roster = []
    renderPage()
    await waitFor(() => expect(mockSyncRoster).toHaveBeenCalledTimes(1))
    expect(mockSyncRoster).toHaveBeenCalledWith('p1')
  })
})

describe('HostDashboardPage in a Dual Experience party', () => {
  const MATT: PartyGuest = { uid: 'g-matt', participantKey: 'g_m', nickname: 'Matt', joinedAt: 1, revoked: false, group: 'guided' }
  const RICHY: PartyGuest = { uid: 'g-richy', participantKey: 'g_r', nickname: 'Richy', joinedAt: 2, revoked: false, group: 'blind' }

  beforeEach(() => {
    localStorage.clear()
    admins = [HOST_ADMIN]
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockSyncRoster.mockReset().mockResolvedValue({ count: 3 })
    mockGetKeyAccessLog.mockReset().mockResolvedValue([])
    mockUseGuidedBottles.mockReset()
    mockAssignGroup.mockReset().mockResolvedValue({ ok: true, group: 'guided' })
    party = makeParty({ format: 'dual', dual: { joinGroup: 'blind', plannedGuided: 7, plannedBlind: 3 }, categories: [makeCategory({ state: 'voting_open' })] })
    guests = [{ ...HOST, group: 'guided' }, MATT, RICHY]
    myBallots = []
    roster = [
      { ...ROSTER_HOST, group: 'guided', progress: { c1: 'submitted' } },
      { id: 'g_m', name: 'Matt', role: 'guest', tasting: true, joinedAt: 1, progress: { c1: 'tasting' }, group: 'guided' },
      { id: 'g_r', name: 'Richy', role: 'guest', tasting: true, joinedAt: 2, progress: { c1: 'submitted' }, group: 'blind' },
    ]
  })

  it('shows group counts against the plan and each round’s submissions per group', () => {
    renderPage()
    expect(screen.getByText('Host dashboard · Dual Experience')).toBeInTheDocument()
    expect(screen.getByText('Guided: 1 of 2 submitted')).toBeInTheDocument()
    expect(screen.getByText('Blind: 1 of 1 submitted')).toBeInTheDocument()
    expect(screen.getByText('/ 7', { exact: false })).toBeInTheDocument()
  })

  it('gives a guided host the guided bottles in My Tasting, and a blind host nothing', () => {
    renderPage()
    expect(mockUseGuidedBottles).toHaveBeenLastCalledWith('p1', true)
    guests = [{ ...HOST, group: 'blind' }, MATT, RICHY]
    mockUseGuidedBottles.mockReset()
    renderPage()
    expect(mockUseGuidedBottles).not.toHaveBeenCalledWith('p1', true)
  })

  it('moves a guest between groups, and asks first when they have already scored', async () => {
    renderPage()
    const participants = screen.getByRole('region', { name: 'Participants' })
    await userEvent.click(within(within(participants).getByRole('radiogroup', { name: 'Richy’s group' })).getByRole('radio', { name: 'Guided' }))
    expect(mockAssignGroup).toHaveBeenCalledWith('p1', 'g_r', 'guided', false)

    mockAssignGroup.mockReset().mockResolvedValueOnce({ ok: false, needsConfirm: true, scoredRounds: 1 }).mockResolvedValueOnce({ ok: true, group: 'blind', movedBallots: 1 })
    await userEvent.click(within(within(participants).getByRole('radiogroup', { name: 'Matt’s group' })).getByRole('radio', { name: 'Blind' }))
    const dialog = await screen.findByRole('dialog', { hidden: true })
    expect(within(dialog).getByText(/marked not fully blind/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to Blind', hidden: true }))
    expect(mockAssignGroup).toHaveBeenLastCalledWith('p1', 'g_m', 'blind', true)
  })

  it('lets a co-host move guests but not the host', () => {
    admins = [HOST_ADMIN, PAT_ADMIN]
    mockUseAuth.mockReturnValue({ user: { uid: 'co-1' }, loading: false })
    renderPage()
    const participants = screen.getByRole('region', { name: 'Participants' })
    const hostSwitch = within(participants).getByRole('radiogroup', { name: 'Kevin’s group' })
    for (const radio of within(hostSwitch).getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(within(within(participants).getByRole('radiogroup', { name: 'Richy’s group' })).getByRole('radio', { name: 'Guided' })).toBeEnabled()
  })
})
