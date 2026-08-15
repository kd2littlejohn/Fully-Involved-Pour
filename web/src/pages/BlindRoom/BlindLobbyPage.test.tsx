import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BlindLobbyPage } from './BlindLobbyPage'
import type { BlindParticipant, BlindRoom } from '../../data/types'

const mockUseAuth = vi.fn()
const mockNavigate = vi.fn()
const mockUseBlindRoom = vi.fn()
const mockSetParticipantReady = vi.fn().mockResolvedValue(undefined)
const mockStartBlind = vi.fn().mockResolvedValue(undefined)
const mockJoinBlindRoomByCode = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], username: 'kevin' } }),
}))

vi.mock('../../hooks/useBlindRoom', () => ({
  useBlindRoom: (...args: unknown[]) => mockUseBlindRoom(...args),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../data/repositories/blindRoom', () => ({
  setParticipantReady: (...args: unknown[]) => mockSetParticipantReady(...args),
  startBlind: (...args: unknown[]) => mockStartBlind(...args),
  joinBlindRoomByCode: (...args: unknown[]) => mockJoinBlindRoomByCode(...args),
}))

const room: BlindRoom = {
  id: 'room-1',
  code: 'OAK742',
  name: 'Friday Night Blind',
  hostUid: 'host-1',
  hostUsername: 'kevin',
  sessionType: 'live',
  knowledgeMode: 'single',
  pourCount: 3,
  state: 'lobby',
  createdAt: Date.now(),
  participantCount: 2,
}

const host: BlindParticipant = { uid: 'host-1', username: 'kevin', isHost: true, status: 'ready', joinedAt: Date.now() }
const guest: BlindParticipant = { uid: 'guest-1', username: 'marcus', isHost: false, status: 'joined', joinedAt: Date.now() }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/blind/room-1/lobby']}>
      <Routes>
        <Route path="/blind/:roomId/lobby" element={<BlindLobbyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BlindLobbyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the roster with host and readiness badges', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('Friday Night Blind')).toBeInTheDocument()
    expect(screen.getByText('kevin')).toBeInTheDocument()
    expect(screen.getByText('marcus')).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 ready')).toBeInTheDocument()
  })

  it('disables Start Blind for the host until every participant is ready', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByRole('button', { name: 'Start Blind' })).toBeDisabled()
  })

  it('enables Start Blind once everyone is ready, and starting it calls startBlind', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    const readyGuest: BlindParticipant = { ...guest, status: 'ready' }
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, readyGuest], loading: false, refresh: vi.fn() })
    renderPage()

    const startButton = screen.getByRole('button', { name: 'Start Blind' })
    expect(startButton).toBeEnabled()
    await userEvent.click(startButton)

    expect(mockStartBlind).toHaveBeenCalledWith('room-1')
  })

  it('does not show a Start Blind control to a non-host participant', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.queryByRole('button', { name: 'Start Blind' })).not.toBeInTheDocument()
  })

  it('lets a participant toggle their own readiness', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'I’m Ready' }))
    expect(mockSetParticipantReady).toHaveBeenCalledWith('room-1', 'guest-1', true)
  })

  it('shows a join prompt for a signed-in user who hasn’t joined this room yet', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'outsider-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('You haven’t joined this Blind Room yet.')).toBeInTheDocument()
  })

  it('shows an honest placeholder once tasting has started, not a fabricated tasting UI', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: { ...room, state: 'active' }, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('Tasting is underway.')).toBeInTheDocument()
    expect(screen.queryByText('Start Blind')).not.toBeInTheDocument()
  })

  it('shows an empty state when the room cannot be found', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: undefined, participants: [], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('We couldn’t find this Blind Room.')).toBeInTheDocument()
  })
})
