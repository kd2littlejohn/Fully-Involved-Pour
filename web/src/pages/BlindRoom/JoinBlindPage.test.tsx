import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinBlindPage } from './JoinBlindPage'
import type { BlindRoom } from '../../data/types'

const mockUseAuth = vi.fn()
const mockNavigate = vi.fn()
const mockGetBlindRoomByCode = vi.fn()
const mockJoinBlindRoomByCode = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [], username: 'marcus' } }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../data/repositories/blindRoom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/blindRoom')>()
  return {
    ...actual,
    getBlindRoomByCode: (...args: unknown[]) => mockGetBlindRoomByCode(...args),
    joinBlindRoomByCode: (...args: unknown[]) => mockJoinBlindRoomByCode(...args),
  }
})

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
  participantCount: 1,
}

function renderPage(initialPath = '/blind/join') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/blind/join" element={<JoinBlindPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinBlindPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('looks up a room by code and shows a preview', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1', displayName: 'Marcus' }, loading: false })
    mockGetBlindRoomByCode.mockResolvedValue(room)
    renderPage()

    await userEvent.type(screen.getByLabelText('Room code'), 'OAK742')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))

    expect(await screen.findByText('Friday Night Blind')).toBeInTheDocument()
    expect(screen.getByText('Hosted by kevin')).toBeInTheDocument()
  })

  it('shows a clear error for an invalid code', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1', displayName: 'Marcus' }, loading: false })
    mockGetBlindRoomByCode.mockResolvedValue(undefined)
    renderPage()

    await userEvent.type(screen.getByLabelText('Room code'), 'ZZZZZZ')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))

    expect(await screen.findByText(/doesn.t match/)).toBeInTheDocument()
  })

  it('prompts sign-in before allowing an unauthenticated visitor to join', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockGetBlindRoomByCode.mockResolvedValue(room)
    renderPage()

    await userEvent.type(screen.getByLabelText('Room code'), 'OAK742')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))

    expect(await screen.findByText('Sign in to join this Blind Room.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join Blind' })).not.toBeInTheDocument()
  })

  it('joins the room and navigates to its lobby', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1', displayName: 'Marcus' }, loading: false })
    mockGetBlindRoomByCode.mockResolvedValue(room)
    mockJoinBlindRoomByCode.mockResolvedValue({ ...room, participantCount: 2 })
    renderPage()

    await userEvent.type(screen.getByLabelText('Room code'), 'OAK742')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Join Blind' }))

    expect(mockJoinBlindRoomByCode).toHaveBeenCalledWith('OAK742', 'guest-1', 'marcus')
    expect(mockNavigate).toHaveBeenCalledWith('/blind/room-1/lobby')
  })

  it('shows a permission-specific message when the join write is rejected by Firestore rules', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1', displayName: 'Marcus' }, loading: false })
    mockGetBlindRoomByCode.mockResolvedValue(room)
    mockJoinBlindRoomByCode.mockRejectedValue(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }))
    renderPage()

    await userEvent.type(screen.getByLabelText('Room code'), 'OAK742')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Join Blind' }))

    expect(await screen.findByText(/don.t have permission to join/)).toBeInTheDocument()
  })

  it('falls back to a generic message for a non-permission join failure', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1', displayName: 'Marcus' }, loading: false })
    mockGetBlindRoomByCode.mockResolvedValue(room)
    mockJoinBlindRoomByCode.mockRejectedValue(new Error('network error'))
    renderPage()

    await userEvent.type(screen.getByLabelText('Room code'), 'OAK742')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Join Blind' }))

    expect(await screen.findByText('Could not join that Blind Room. Please try again.')).toBeInTheDocument()
  })

  it('auto-looks-up a code passed in the URL', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1', displayName: 'Marcus' }, loading: false })
    mockGetBlindRoomByCode.mockResolvedValue(room)
    renderPage('/blind/join?code=oak742')

    expect(await screen.findByText('Friday Night Blind')).toBeInTheDocument()
    expect(mockGetBlindRoomByCode).toHaveBeenCalledWith('oak742')
  })
})
