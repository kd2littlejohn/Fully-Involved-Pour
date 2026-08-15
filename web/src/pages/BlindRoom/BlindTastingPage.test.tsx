import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BlindTastingPage } from './BlindTastingPage'
import type { BlindParticipant, BlindRoom, BlindTastingResponse } from '../../data/types'

const mockUseAuth = vi.fn()
const mockNavigate = vi.fn()
const mockUseBlindRoom = vi.fn()
const mockGetTastingResponses = vi.fn()
const mockSaveTastingResponse = vi.fn()
const mockLockTastingResponse = vi.fn()
const mockMarkTastingStarted = vi.fn()
const mockMarkTastingCompleted = vi.fn()
const mockGetFinalRanking = vi.fn()
const mockSaveFinalRanking = vi.fn()
const mockLockFinalRanking = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useBlindRoom', () => ({
  useBlindRoom: (...args: unknown[]) => mockUseBlindRoom(...args),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../data/repositories/blindRoom', () => ({
  getTastingResponses: (...args: unknown[]) => mockGetTastingResponses(...args),
  saveTastingResponse: (...args: unknown[]) => mockSaveTastingResponse(...args),
  lockTastingResponse: (...args: unknown[]) => mockLockTastingResponse(...args),
  markTastingStarted: (...args: unknown[]) => mockMarkTastingStarted(...args),
  markTastingCompleted: (...args: unknown[]) => mockMarkTastingCompleted(...args),
  getFinalRanking: (...args: unknown[]) => mockGetFinalRanking(...args),
  saveFinalRanking: (...args: unknown[]) => mockSaveFinalRanking(...args),
  lockFinalRanking: (...args: unknown[]) => mockLockFinalRanking(...args),
}))

const room: BlindRoom = {
  id: 'room-1',
  code: 'OAK742',
  name: 'Friday Night Blind',
  hostUid: 'host-1',
  hostUsername: 'kevin',
  sessionType: 'live',
  knowledgeMode: 'double',
  pourCount: 2,
  state: 'active',
  createdAt: Date.now(),
  participantCount: 1,
}

const me: BlindParticipant = { uid: 'host-1', username: 'kevin', isHost: true, status: 'ready', joinedAt: Date.now() }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/blind/room-1/taste']}>
      <Routes>
        <Route path="/blind/:roomId/taste" element={<BlindTastingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BlindTastingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveTastingResponse.mockResolvedValue(undefined)
    mockLockTastingResponse.mockResolvedValue(undefined)
    mockMarkTastingStarted.mockResolvedValue(undefined)
    mockMarkTastingCompleted.mockResolvedValue(undefined)
    mockSaveFinalRanking.mockResolvedValue(undefined)
    mockLockFinalRanking.mockResolvedValue(undefined)
    mockGetTastingResponses.mockResolvedValue([])
    mockGetFinalRanking.mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room, participants: [me], loading: false, refresh: vi.fn() })
  })

  it('shows Pour A first and disables Lock & Next until a reaction is picked', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Pour A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock & Next' })).toBeDisabled()
  })

  it('marks tasting started for a participant landing here for the first time', async () => {
    renderPage()
    await waitFor(() => expect(mockMarkTastingStarted).toHaveBeenCalledWith('room-1', 'host-1'))
  })

  it('locking a non-final pour saves, locks, and advances to the next pour', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Pour A' })

    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock & Next' }))

    await waitFor(() => expect(mockLockTastingResponse).toHaveBeenCalledWith('room-1', 'host-1', 'A'))
    expect(mockSaveTastingResponse).toHaveBeenCalledWith(
      'room-1',
      'host-1',
      'A',
      expect.objectContaining({ reaction: 'Love It' }),
    )
    expect(await screen.findByRole('heading', { name: 'Pour B' })).toBeInTheDocument()
  })

  it('locking the final pour moves into the ranking step instead of finishing immediately', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Pour A' })
    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock & Next' }))
    await screen.findByRole('heading', { name: 'Pour B' })

    await userEvent.click(screen.getByRole('button', { name: /Enjoying It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock & Rank' }))

    expect(await screen.findByRole('heading', { name: 'Rank Your Pours' })).toBeInTheDocument()
    expect(mockMarkTastingCompleted).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('requires every pour ranked before Lock Ranking & Finish is enabled, then locks and completes tasting', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Pour A' })
    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock & Next' }))
    await screen.findByRole('heading', { name: 'Pour B' })
    await userEvent.click(screen.getByRole('button', { name: /Enjoying It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock & Rank' }))
    await screen.findByRole('heading', { name: 'Rank Your Pours' })

    const lockRankingButton = screen.getByRole('button', { name: 'Lock Ranking & Finish' })
    expect(lockRankingButton).toBeDisabled()

    await userEvent.click(screen.getByText('Pour B'))
    expect(lockRankingButton).toBeDisabled()
    await userEvent.click(screen.getByText('Pour A'))
    expect(lockRankingButton).toBeEnabled()

    await userEvent.click(lockRankingButton)

    await waitFor(() => expect(mockLockFinalRanking).toHaveBeenCalledWith('room-1', 'host-1', ['B', 'A']))
    expect(mockMarkTastingCompleted).toHaveBeenCalledWith('room-1', 'host-1')
    expect(mockNavigate).toHaveBeenCalledWith('/blind/room-1/lobby')
  })

  it('jumps straight into the ranking step if every pour was already locked in an earlier visit', async () => {
    const now = Date.now()
    mockGetTastingResponses.mockResolvedValue([
      { pourLabel: 'A', reaction: 'Love It', status: 'locked', updatedAt: now, lockedAt: now },
      { pourLabel: 'B', reaction: 'Enjoying It', status: 'locked', updatedAt: now, lockedAt: now },
    ])
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Rank Your Pours' })).toBeInTheDocument()
  })

  it('shows a locked ranking as read-only when returning after finishing', async () => {
    const now = Date.now()
    mockGetTastingResponses.mockResolvedValue([
      { pourLabel: 'A', reaction: 'Love It', status: 'locked', updatedAt: now, lockedAt: now },
      { pourLabel: 'B', reaction: 'Enjoying It', status: 'locked', updatedAt: now, lockedAt: now },
    ])
    mockGetFinalRanking.mockResolvedValue({ order: ['B', 'A'], status: 'locked', updatedAt: now, lockedAt: now })
    renderPage()

    expect(await screen.findByText('Locked in — your ranking can’t be changed.')).toBeInTheDocument()
    expect(screen.getByText('Pour B').closest('button')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back to Lobby' })).toBeInTheDocument()
  })

  it('shows an already-locked pour as read-only when returning to it', async () => {
    const locked: BlindTastingResponse = {
      pourLabel: 'A',
      reaction: 'Love It',
      fipScore: 9.3,
      status: 'locked',
      updatedAt: Date.now(),
      lockedAt: Date.now(),
    }
    mockGetTastingResponses.mockResolvedValue([locked])
    renderPage()

    expect(await screen.findByText('Locked in — this pour can’t be changed.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Love It/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next Pour' })).toBeInTheDocument()
  })

  it('shows a lineup hint for Single Blind rooms', async () => {
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, knowledgeMode: 'single', knownLineup: ['Stagg Jr.', 'Eagle Rare'] },
      participants: [me],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()
    expect(await screen.findByText('In this lineup: Stagg Jr., Eagle Rare')).toBeInTheDocument()
  })

  it("tells a participant to go back to the lobby if tasting hasn't started", async () => {
    mockUseBlindRoom.mockReturnValue({ room: { ...room, state: 'lobby' }, participants: [me], loading: false, refresh: vi.fn() })
    renderPage()
    expect(await screen.findByText("Tasting hasn't started yet.")).toBeInTheDocument()
  })

  it('prompts sign-in for an unauthenticated visitor', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderPage()
    expect(await screen.findByText('Sign in to continue.')).toBeInTheDocument()
  })
})
