import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BlindRoomLandingPage } from './BlindRoomLandingPage'
import type { BlindParticipant, BlindRoom } from '../../data/types'

const mockUseAuth = vi.fn()
const mockGetMyBlindRooms = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../data/repositories/blindRoom', () => ({
  getMyBlindRooms: (...args: unknown[]) => mockGetMyBlindRooms(...args),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <BlindRoomLandingPage />
    </MemoryRouter>,
  )
}

function room(overrides: Partial<BlindRoom> = {}): BlindRoom {
  return {
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
    ...overrides,
  }
}

const participant: BlindParticipant = { uid: 'host-1', username: 'kevin', isHost: true, status: 'ready', joinedAt: Date.now() }

describe('BlindRoomLandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prompts sign-in when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderPage()
    expect(screen.getByText('Taste blind, together.')).toBeInTheDocument()
  })

  it('shows Create Blind and Join Blind actions', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No active Blind Rooms.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create Blind' })).toHaveAttribute('href', '/blind/new')
    expect(screen.getByRole('link', { name: 'Join Blind' })).toHaveAttribute('href', '/blind/join')
  })

  it('splits rooms into Active and Recent based on state', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([
      { room: room({ id: 'active-1', name: 'Active One', state: 'lobby' }), participant },
      { room: room({ id: 'done-1', name: 'Done One', state: 'completed' }), participant },
    ])
    renderPage()

    expect(await screen.findByText('Active One')).toBeInTheDocument()
    expect(screen.getByText('Done One')).toBeInTheDocument()
    expect(screen.getByText('Recent Blinds')).toBeInTheDocument()
  })

  it('does not show a Recent Blinds section when there are no completed rooms', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room(), participant }])
    renderPage()

    expect(await screen.findByText('Friday Night Blind')).toBeInTheDocument()
    expect(screen.queryByText('Recent Blinds')).not.toBeInTheDocument()
  })
})
