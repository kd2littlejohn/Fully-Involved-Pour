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
const mockRevealBlind = vi.fn().mockResolvedValue(undefined)

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
  revealBlind: (...args: unknown[]) => mockRevealBlind(...args),
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
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
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

  it('shows a Start Tasting control once tasting has started, for a participant who hasn’t started yet', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: { ...room, state: 'active' }, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByRole('button', { name: 'Start Tasting' })).toBeInTheDocument()
    expect(screen.queryByText('Start Blind')).not.toBeInTheDocument()
  })

  it('shows Continue Tasting for a participant already mid-tasting', () => {
    const tastingHost: BlindParticipant = { ...host, status: 'tasting' }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, state: 'active' },
      participants: [tastingHost, guest],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()

    expect(screen.getByRole('button', { name: 'Continue Tasting' })).toBeInTheDocument()
  })

  it('shows a waiting message once this participant has completed tasting, not a tasting button', () => {
    const doneHost: BlindParticipant = { ...host, status: 'completed' }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, state: 'active' },
      participants: [doneHost, guest],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()

    expect(screen.getByText('You’re all locked in.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Tasting' })).not.toBeInTheDocument()
  })

  it('navigates to the tasting page when Start Tasting is tapped', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: { ...room, state: 'active' }, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Start Tasting' }))
    expect(mockNavigate).toHaveBeenCalledWith('/blind/room-1/taste')
  })

  it('shows the host a Reveal button once every participant has completed tasting', () => {
    const doneHost: BlindParticipant = { ...host, status: 'completed' }
    const doneGuest: BlindParticipant = { ...guest, status: 'completed' }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, state: 'active' },
      participants: [doneHost, doneGuest],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()

    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument()
  })

  it('does not show a Reveal button to a non-host, even once everyone has completed tasting', () => {
    const doneHost: BlindParticipant = { ...host, status: 'completed' }
    const doneGuest: BlindParticipant = { ...guest, status: 'completed' }
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, state: 'active' },
      participants: [doneHost, doneGuest],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()

    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('does not show a Reveal button while someone is still tasting, even to the host', () => {
    const doneHost: BlindParticipant = { ...host, status: 'completed' }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, state: 'active' },
      participants: [doneHost, guest],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()

    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('tapping Reveal calls revealBlind', async () => {
    const doneHost: BlindParticipant = { ...host, status: 'completed' }
    const doneGuest: BlindParticipant = { ...guest, status: 'completed' }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, state: 'active' },
      participants: [doneHost, doneGuest],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(mockRevealBlind).toHaveBeenCalledWith('room-1')
  })

  it('shows a See Results control once the room has been revealed, and it navigates to the reveal page', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, state: 'revealed' },
      participants: [host, guest],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'See Results' }))
    expect(mockNavigate).toHaveBeenCalledWith('/blind/room-1/reveal')
  })

  it('shows the deadline for an active Blind Challenge room whose deadline hasn’t passed', () => {
    const challengeRoom: BlindRoom = { ...room, sessionType: 'challenge', state: 'active', deadline: Date.now() + 60_000 }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: challengeRoom, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText(/^Deadline /)).toBeInTheDocument()
    expect(screen.queryByText('Deadline passed')).not.toBeInTheDocument()
  })

  it('shows Deadline passed once a Blind Challenge’s deadline has elapsed', () => {
    const challengeRoom: BlindRoom = { ...room, sessionType: 'challenge', state: 'active', deadline: Date.now() - 60_000 }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: challengeRoom, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('Deadline passed')).toBeInTheDocument()
  })

  it('does not show a deadline note for a Live Blind room', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: { ...room, state: 'active' }, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.queryByText(/Deadline/)).not.toBeInTheDocument()
  })

  it('lets the host reveal a Blind Challenge once the deadline has passed, even if not everyone finished', () => {
    const doneHost: BlindParticipant = { ...host, status: 'completed' }
    const challengeRoom: BlindRoom = { ...room, sessionType: 'challenge', state: 'active', deadline: Date.now() - 60_000 }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: challengeRoom, participants: [doneHost, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument()
    expect(screen.getByText('The deadline has passed — ready to reveal?')).toBeInTheDocument()
  })

  it('tells a waiting non-host participant the deadline has passed, without offering Reveal', () => {
    const doneGuest: BlindParticipant = { ...guest, status: 'completed' }
    const challengeRoom: BlindRoom = { ...room, sessionType: 'challenge', state: 'active', deadline: Date.now() - 60_000 }
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: challengeRoom, participants: [host, doneGuest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('The deadline has passed. Waiting for the host to reveal.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('does not unlock Reveal early for a Blind Challenge whose deadline hasn’t passed', () => {
    const doneHost: BlindParticipant = { ...host, status: 'completed' }
    const challengeRoom: BlindRoom = { ...room, sessionType: 'challenge', state: 'active', deadline: Date.now() + 60_000 }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: challengeRoom, participants: [doneHost, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('shows the host a Send Reminder action for a Blind Challenge with unfinished participants', () => {
    const challengeRoom: BlindRoom = { ...room, sessionType: 'challenge', state: 'active', deadline: Date.now() + 60_000 }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: challengeRoom, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByRole('button', { name: 'Send Reminder' })).toBeInTheDocument()
  })

  it('does not show Send Reminder for a Live Blind room', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: { ...room, state: 'active' }, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.queryByRole('button', { name: 'Send Reminder' })).not.toBeInTheDocument()
  })

  it('does not show Send Reminder once everyone has finished tasting', () => {
    const doneHost: BlindParticipant = { ...host, status: 'completed' }
    const doneGuest: BlindParticipant = { ...guest, status: 'completed' }
    const challengeRoom: BlindRoom = { ...room, sessionType: 'challenge', state: 'active', deadline: Date.now() + 60_000 }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: challengeRoom, participants: [doneHost, doneGuest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.queryByRole('button', { name: 'Send Reminder' })).not.toBeInTheDocument()
  })

  it('copies a reminder message naming who hasn’t finished when Send Reminder is tapped', async () => {
    const challengeRoom: BlindRoom = { ...room, sessionType: 'challenge', state: 'active', deadline: Date.now() + 60_000 }
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: challengeRoom, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Send Reminder' }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('marcus'))
    expect(await screen.findByRole('button', { name: 'Reminder Copied' })).toBeInTheDocument()
  })

  it('shows an empty state when the room cannot be found', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockUseBlindRoom.mockReturnValue({ room: undefined, participants: [], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('We couldn’t find this Blind Room.')).toBeInTheDocument()
  })
})
