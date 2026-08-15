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
    mockGetTastingResponses.mockResolvedValue([])
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

  it('locking the final pour marks tasting completed and returns to the lobby', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Pour A' })
    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock & Next' }))
    await screen.findByRole('heading', { name: 'Pour B' })

    await userEvent.click(screen.getByRole('button', { name: /Enjoying It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock & Finish' }))

    await waitFor(() => expect(mockMarkTastingCompleted).toHaveBeenCalledWith('room-1', 'host-1'))
    expect(mockNavigate).toHaveBeenCalledWith('/blind/room-1/lobby')
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
