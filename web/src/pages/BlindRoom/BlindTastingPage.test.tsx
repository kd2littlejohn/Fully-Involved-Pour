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
const mockGetComparisons = vi.fn()
const mockSaveComparison = vi.fn()

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
  getComparisons: (...args: unknown[]) => mockGetComparisons(...args),
  saveComparison: (...args: unknown[]) => mockSaveComparison(...args),
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

async function pickGuideMe() {
  await screen.findByText('How would you like me to guide tonight’s tasting?')
  await userEvent.click(screen.getByRole('button', { name: /Guide Me/ }))
}

describe('BlindTastingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockSaveTastingResponse.mockResolvedValue(undefined)
    mockLockTastingResponse.mockResolvedValue(undefined)
    mockMarkTastingStarted.mockResolvedValue(undefined)
    mockMarkTastingCompleted.mockResolvedValue(undefined)
    mockSaveFinalRanking.mockResolvedValue(undefined)
    mockLockFinalRanking.mockResolvedValue(undefined)
    mockSaveComparison.mockResolvedValue(undefined)
    mockGetTastingResponses.mockResolvedValue([])
    mockGetFinalRanking.mockResolvedValue(undefined)
    mockGetComparisons.mockResolvedValue([])
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room, participants: [me], loading: false, refresh: vi.fn() })
  })

  it('asks how to guide the tasting before anything else, defaulting new users to Guide Me', async () => {
    renderPage()
    expect(await screen.findByText('How would you like me to guide tonight’s tasting?')).toBeInTheDocument()
    const guideMeButton = screen.getByRole('button', { name: /Guide Me/ })
    expect(guideMeButton.className).toMatch(/choiceCardActive/)
  })

  it('marks tasting started for a participant landing here for the first time', async () => {
    renderPage()
    await waitFor(() => expect(mockMarkTastingStarted).toHaveBeenCalledWith('room-1', 'host-1'))
  })

  it('walks Guide Me through nose (broad + detail), reaction, liked characteristic, and finish for Pour A', async () => {
    renderPage()
    await pickGuideMe()

    expect(await screen.findByRole('heading', { name: 'Pour A' })).toBeInTheDocument()
    expect(screen.getByText('Give Pour A a smell. What stands out?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sweet' }))
    expect(mockSaveTastingResponse).toHaveBeenCalledWith('room-1', 'host-1', 'A', { noseBroad: 'Sweet' })

    expect(await screen.findByText('Any more specific sweet notes?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Caramel' }))

    expect(await screen.findByText('Take a sip. What’s your first reaction?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    expect(mockSaveTastingResponse).toHaveBeenCalledWith('room-1', 'host-1', 'A', { reaction: 'Love It', fipScore: 9.3 })

    expect(await screen.findByText('What do you like most about it?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sweetness' }))

    expect(await screen.findByText('After you swallow, what happens?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hangs Around' }))
    expect(mockSaveTastingResponse).toHaveBeenCalledWith('room-1', 'host-1', 'A', {
      finishImpression: 'Hangs Around',
      finishLength: 'medium',
    })

    // Only one pour answered so far — no comparison yet, straight to Pour B.
    expect(await screen.findByRole('heading', { name: 'Pour B' })).toBeInTheDocument()
  })

  it('skips the nose second-level question for a broad flavor with no detail list', async () => {
    renderPage()
    await pickGuideMe()
    await userEvent.click(screen.getByRole('button', { name: 'Oaky' }))
    expect(await screen.findByText('Take a sip. What’s your first reaction?')).toBeInTheDocument()
  })

  it('asks only the reaction for I’ve Got This (minimal guidance)', async () => {
    renderPage()
    await screen.findByText('How would you like me to guide tonight’s tasting?')
    await userEvent.click(screen.getByRole('button', { name: /I.ve Got This/ }))

    expect(await screen.findByRole('heading', { name: 'Pour A' })).toBeInTheDocument()
    expect(screen.getByText('Take a sip. What’s your first reaction?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))

    // Straight to Pour B — no nose/liked/finish questions at all.
    expect(await screen.findByRole('heading', { name: 'Pour B' })).toBeInTheDocument()
  })

  it('runs a comparison after the second pour, then moves into ranking once answered', async () => {
    renderPage()
    await screen.findByText('How would you like me to guide tonight’s tasting?')
    await userEvent.click(screen.getByRole('button', { name: /I.ve Got This/ }))
    await screen.findByRole('heading', { name: 'Pour A' })
    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await screen.findByRole('heading', { name: 'Pour B' })
    await userEvent.click(screen.getByRole('button', { name: /Enjoying It/ }))

    expect(await screen.findByText('Which one would you rather pour another glass of?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pour B' }))

    expect(await screen.findByText('What gave it the edge?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Better Flavor' }))

    await waitFor(() =>
      expect(mockSaveComparison).toHaveBeenCalledWith(
        'room-1',
        'host-1',
        expect.objectContaining({ id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'B', reason: 'better-flavor' }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Rank Your Pours' })).toBeInTheDocument()
  })

  it('requires every pour ranked before Lock Ranking & Finish is enabled, then locks everything and completes tasting', async () => {
    renderPage()
    await screen.findByText('How would you like me to guide tonight’s tasting?')
    await userEvent.click(screen.getByRole('button', { name: /I.ve Got This/ }))
    await screen.findByRole('heading', { name: 'Pour A' })
    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await screen.findByRole('heading', { name: 'Pour B' })
    await userEvent.click(screen.getByRole('button', { name: /Enjoying It/ }))
    await screen.findByText('Which one would you rather pour another glass of?')
    await userEvent.click(screen.getByRole('button', { name: 'Pour B' }))
    await screen.findByText('What gave it the edge?')
    await userEvent.click(screen.getByRole('button', { name: 'Better Flavor' }))
    await screen.findByRole('heading', { name: 'Rank Your Pours' })

    const lockRankingButton = screen.getByRole('button', { name: 'Lock Ranking & Finish' })
    expect(lockRankingButton).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Pour B' }))
    expect(lockRankingButton).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Pour A' }))
    expect(lockRankingButton).toBeEnabled()

    await userEvent.click(lockRankingButton)

    await waitFor(() => expect(mockLockFinalRanking).toHaveBeenCalledWith('room-1', 'host-1', ['B', 'A']))
    expect(mockLockTastingResponse).toHaveBeenCalledWith('room-1', 'host-1', 'A')
    expect(mockLockTastingResponse).toHaveBeenCalledWith('room-1', 'host-1', 'B')
    expect(mockMarkTastingCompleted).toHaveBeenCalledWith('room-1', 'host-1')
    expect(mockNavigate).toHaveBeenCalledWith('/blind/room-1/lobby')
  })

  it('shows an error and re-enables Lock Ranking & Finish if saving fails, instead of leaving the button stuck', async () => {
    mockLockFinalRanking.mockRejectedValueOnce(new Error('permission-denied'))
    renderPage()
    await screen.findByText('How would you like me to guide tonight’s tasting?')
    await userEvent.click(screen.getByRole('button', { name: /I.ve Got This/ }))
    await screen.findByRole('heading', { name: 'Pour A' })
    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await screen.findByRole('heading', { name: 'Pour B' })
    await userEvent.click(screen.getByRole('button', { name: /Enjoying It/ }))
    await screen.findByText('Which one would you rather pour another glass of?')
    await userEvent.click(screen.getByRole('button', { name: 'Pour B' }))
    await screen.findByText('What gave it the edge?')
    await userEvent.click(screen.getByRole('button', { name: 'Better Flavor' }))
    await screen.findByRole('heading', { name: 'Rank Your Pours' })
    await userEvent.click(screen.getByRole('button', { name: 'Pour B' }))
    await userEvent.click(screen.getByRole('button', { name: 'Pour A' }))

    await userEvent.click(screen.getByRole('button', { name: 'Lock Ranking & Finish' }))

    expect(await screen.findByText('Could not save your ranking. Check your connection and try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock Ranking & Finish' })).toBeEnabled()
    expect(mockNavigate).not.toHaveBeenCalledWith('/blind/room-1/lobby')
    expect(mockMarkTastingCompleted).not.toHaveBeenCalled()
  })

  it('resumes mid-pour where a returning participant left off, skipping the guidance question', async () => {
    localStorage.setItem('fip:blindGuidance:host-1', 'minimal')
    const now = Date.now()
    mockGetTastingResponses.mockResolvedValue([
      { pourLabel: 'A', reaction: 'Love It', fipScore: 9.3, status: 'in-progress', updatedAt: now } as BlindTastingResponse,
    ])
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Pour B' })).toBeInTheDocument()
    expect(screen.queryByText('How would you like me to guide tonight’s tasting?')).not.toBeInTheDocument()
  })

  it('jumps straight to ranking if every pour and comparison was already answered', async () => {
    localStorage.setItem('fip:blindGuidance:host-1', 'minimal')
    const now = Date.now()
    mockGetTastingResponses.mockResolvedValue([
      { pourLabel: 'A', reaction: 'Love It', fipScore: 9.3, status: 'in-progress', updatedAt: now } as BlindTastingResponse,
      { pourLabel: 'B', reaction: 'Enjoying It', fipScore: 8.3, status: 'in-progress', updatedAt: now } as BlindTastingResponse,
    ])
    mockGetComparisons.mockResolvedValue([
      { id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'B', reason: 'better-flavor', updatedAt: now },
    ])
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Rank Your Pours' })).toBeInTheDocument()
  })

  it('shows a locked ranking as read-only when returning after finishing', async () => {
    const now = Date.now()
    mockGetTastingResponses.mockResolvedValue([
      { pourLabel: 'A', reaction: 'Love It', status: 'locked', updatedAt: now, lockedAt: now } as BlindTastingResponse,
      { pourLabel: 'B', reaction: 'Enjoying It', status: 'locked', updatedAt: now, lockedAt: now } as BlindTastingResponse,
    ])
    mockGetComparisons.mockResolvedValue([
      { id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'B', reason: 'better-flavor', updatedAt: now },
    ])
    mockGetFinalRanking.mockResolvedValue({ order: ['B', 'A'], status: 'locked', updatedAt: now, lockedAt: now })
    renderPage()

    expect(await screen.findByText('Locked in — your ranking can’t be changed.')).toBeInTheDocument()
    expect(screen.getByText('Pour B').closest('button')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back to Lobby' })).toBeInTheDocument()
  })

  it('shows a lineup hint for Single Blind rooms', async () => {
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, knowledgeMode: 'single', knownLineup: ['Stagg Jr.', 'Eagle Rare'] },
      participants: [me],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()
    await pickGuideMe()
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
