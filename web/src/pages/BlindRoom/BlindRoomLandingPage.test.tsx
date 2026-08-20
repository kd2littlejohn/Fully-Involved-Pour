import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BlindRoomLandingPage } from './BlindRoomLandingPage'
import type { BlindParticipant, BlindRoom } from '../../data/types'

const mockUseAuth = vi.fn()
const mockGetMyBlindRooms = vi.fn()
const mockDeleteBlindRoom = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../data/repositories/blindRoom', () => ({
  getMyBlindRooms: (...args: unknown[]) => mockGetMyBlindRooms(...args),
  deleteBlindRoom: (...args: unknown[]) => mockDeleteBlindRoom(...args),
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
    localStorage.clear()
    mockDeleteBlindRoom.mockResolvedValue(undefined)
  })

  it('prompts sign-in when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderPage()
    expect(screen.getByText('Taste blind. Decide for yourself.')).toBeInTheDocument()
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

  it('shows a real error state instead of a misleading "no blinds" empty state when the fetch fails', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockRejectedValueOnce(new Error('failed-precondition'))
    renderPage()

    expect(await screen.findByText('We couldn’t load your Blind Rooms.')).toBeInTheDocument()
    expect(screen.getByText(/failed-precondition/)).toBeInTheDocument()
    expect(screen.queryByText('No active Blind Rooms.')).not.toBeInTheDocument()

    mockGetMyBlindRooms.mockResolvedValueOnce([{ room: room({ name: 'Recovered Blind' }), participant }])
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(mockGetMyBlindRooms).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Recovered Blind')).toBeInTheDocument()
  })

  it('includes the Firestore error code in the on-screen message when the SDK provides one', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockRejectedValueOnce(
      Object.assign(new Error('The query requires an index.'), { code: 'failed-precondition' }),
    )
    renderPage()

    expect(await screen.findByText(/failed-precondition: The query requires an index\./)).toBeInTheDocument()
  })

  async function openDeleteConfirm(roomName: string) {
    await userEvent.click(screen.getByRole('button', { name: `${roomName} actions` }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete Blind' }))
    expect(screen.getByText('Delete this blind?')).toBeInTheDocument()
    expect(screen.getByText('This will remove the saved blind results and related history. This cannot be undone.')).toBeInTheDocument()
  }

  it('lets the host permanently delete a blind after confirming', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ name: 'Friday Night Blind' }), participant }])
    renderPage()
    await screen.findByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    await userEvent.click(screen.getByRole('button', { name: 'Delete Blind for Everyone' }))

    await waitFor(() => expect(mockDeleteBlindRoom).toHaveBeenCalledWith('room-1'))
    expect(screen.queryByText('Friday Night Blind')).not.toBeInTheDocument()
  })

  it('does not delete the blind if the host cancels the confirmation', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ name: 'Friday Night Blind' }), participant }])
    renderPage()
    await screen.findByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockDeleteBlindRoom).not.toHaveBeenCalled()
    expect(screen.getByText('Friday Night Blind')).toBeInTheDocument()
  })

  it('disables the confirm button and shows Deleting… while the delete is in flight, so a second tap cannot double-fire it', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ name: 'Friday Night Blind' }), participant }])
    let resolveDelete: () => void = () => {}
    mockDeleteBlindRoom.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve
      }),
    )
    renderPage()
    await screen.findByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    const confirmButton = screen.getByRole('button', { name: 'Delete Blind for Everyone' })
    await userEvent.click(confirmButton)

    const deletingButton = screen.getByRole('button', { name: 'Deleting…' })
    expect(deletingButton).toBeDisabled()
    await userEvent.click(deletingButton)
    expect(mockDeleteBlindRoom).toHaveBeenCalledTimes(1)

    resolveDelete()
    await waitFor(() => expect(screen.queryByText('Friday Night Blind')).not.toBeInTheDocument())
  })

  it('keeps the blind visible and shows a retry message if the delete fails', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ name: 'Friday Night Blind' }), participant }])
    mockDeleteBlindRoom.mockRejectedValueOnce(new Error('network error'))
    renderPage()
    await screen.findByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    await userEvent.click(screen.getByRole('button', { name: 'Delete Blind for Everyone' }))

    expect(await screen.findByText('We couldn’t delete this blind. Try again.')).toBeInTheDocument()
    expect(screen.getByText('Friday Night Blind')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Blind for Everyone' })).not.toBeDisabled()
  })

  it('lets a non-host participant remove a blind from just their own list, without deleting it', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([
      { room: room({ name: 'Friday Night Blind', hostUid: 'host-1' }), participant },
    ])
    renderPage()
    await screen.findByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    await userEvent.click(screen.getByRole('button', { name: 'Remove From My History' }))

    expect(mockDeleteBlindRoom).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Friday Night Blind')).not.toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem('fip:hiddenBlindRooms:guest-1') ?? '[]')).toEqual(['room-1'])
  })

  it('keeps a hidden blind hidden across a re-render for the same user', async () => {
    localStorage.setItem('fip:hiddenBlindRooms:host-1', JSON.stringify(['room-1']))
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ name: 'Friday Night Blind' }), participant }])
    renderPage()

    await screen.findByText('No active Blind Rooms.')
    expect(screen.queryByText('Friday Night Blind')).not.toBeInTheDocument()
  })
})
