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

vi.mock('../../data/repositories/blindRoom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/blindRoom')>()
  return {
    ...actual,
    getMyBlindRooms: (...args: unknown[]) => mockGetMyBlindRooms(...args),
    deleteBlindRoom: (...args: unknown[]) => mockDeleteBlindRoom(...args),
  }
})

const mockGetHostedParties = vi.fn()
const mockGetAttendedParties = vi.fn()
vi.mock('../../data/repositories/party', () => ({
  getHostedParties: (...args: unknown[]) => mockGetHostedParties(...args),
  getAttendedParties: (...args: unknown[]) => mockGetAttendedParties(...args),
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
    mockGetHostedParties.mockResolvedValue([])
    mockGetAttendedParties.mockResolvedValue([])
  })

  it('prompts sign-in when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderPage()
    expect(screen.getByText('Taste blind. Decide for yourself.')).toBeInTheDocument()
  })

  it('offers the four ways into a blind tasting, plus joining a friend’s blind', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No active Blind Rooms.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start Solo Blind Tasting/ })).toHaveAttribute('href', '/blind/new?type=solo')
    expect(screen.getByRole('link', { name: /Taste with Friends/ })).toHaveAttribute('href', '/blind/new?type=live')
    expect(screen.getByRole('link', { name: /Host a Tasting Party/ })).toHaveAttribute('href', '/party/new')
    expect(screen.getByRole('link', { name: /Join a Tasting Party/ })).toHaveAttribute('href', '/p')
    expect(screen.getByRole('link', { name: 'Join their blind' })).toHaveAttribute('href', '/blind/join')
    expect(screen.getByRole('link', { name: 'All tasting parties' })).toHaveAttribute('href', '/blind/party')
    expect(screen.queryByText('Resume Tasting')).not.toBeInTheDocument()
  })

  it('puts Resume Tasting above the options for the most recent thing in progress', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ id: 'old', name: 'Older blind', createdAt: 1 }), participant }])
    mockGetHostedParties.mockResolvedValue([{ id: 'pty', name: 'Bourbon Night', status: 'live', myRole: 'host', hostName: 'Kev', createdAt: 5 }])
    renderPage()

    const resume = await screen.findByRole('link', { name: /Resume Tasting/ })
    expect(resume).toHaveAttribute('href', '/party/pty/host')
    expect(resume).toHaveTextContent('Bourbon Night')
    expect(resume).toHaveTextContent('You’re hosting')
    expect(resume.compareDocumentPosition(screen.getByRole('link', { name: /Start Solo Blind Tasting/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('labels a party this account co-hosts from its admin record role', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'co-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([])
    mockGetHostedParties.mockResolvedValue([{ id: 'pty', name: 'Bourbon Night', status: 'live', myRole: 'cohost', hostName: 'Kev', createdAt: 5 }])
    renderPage()

    expect(await screen.findByRole('link', { name: /Resume Tasting/ })).toHaveTextContent('You’re co-hosting')
  })

  it('resumes an in-progress blind at its tasting screen, and ignores finished ones', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([
      { room: room({ id: 'tasting', name: 'Mid pour', state: 'active', createdAt: 3 }), participant },
      { room: room({ id: 'done', name: 'All done', state: 'completed', createdAt: 9 }), participant },
    ])
    mockGetAttendedParties.mockResolvedValue([{ id: 'over', name: 'Finished party', status: 'completed', hostName: 'Sam', createdAt: 10 }])
    renderPage()

    expect((await screen.findAllByRole('link', { name: /Resume Tasting/ })).at(-1)).toHaveAttribute('href', '/blind/tasting/taste')
  })

  it('splits rooms into Active and Recent based on state', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([
      { room: room({ id: 'active-1', name: 'Active One', state: 'lobby' }), participant },
      { room: room({ id: 'done-1', name: 'Done One', state: 'completed' }), participant },
    ])
    renderPage()

    expect((await screen.findAllByText('Active One')).at(-1)).toBeInTheDocument()
    expect(screen.getAllByText('Done One').at(-1)).toBeInTheDocument()
    expect(screen.getByText('Recent Blinds')).toBeInTheDocument()
  })

  it('links a completed blind straight to its results, not the lobby', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ id: 'done-1', name: 'Done One', state: 'completed' }), participant }])
    renderPage()

    expect((await screen.findAllByRole('link', { name: /Done One/ })).at(-1)).toHaveAttribute('href', '/blind/done-1/reveal')
  })

  it('links a revealed blind straight to its results too', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ id: 'rev-1', name: 'Revealed One', state: 'revealed' }), participant }])
    renderPage()

    expect((await screen.findAllByRole('link', { name: /Revealed One/ })).at(-1)).toHaveAttribute('href', '/blind/rev-1/reveal')
  })

  it('links a still-in-progress blind to its lobby, not the reveal page', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ id: 'lobby-1', name: 'Waiting One', state: 'lobby' }), participant }])
    renderPage()

    expect((await screen.findAllByRole('link', { name: /Waiting One/ })).at(-1)).toHaveAttribute('href', '/blind/lobby-1/lobby')
  })

  it('does not show a Recent Blinds section when there are no completed rooms', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room(), participant }])
    renderPage()

    expect((await screen.findAllByText('Friday Night Blind')).at(-1)).toBeInTheDocument()
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
    expect((await screen.findAllByText('Recovered Blind')).at(-1)).toBeInTheDocument()
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
    await screen.findAllByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    await userEvent.click(screen.getByRole('button', { name: 'Delete Blind for Everyone' }))

    await waitFor(() => expect(mockDeleteBlindRoom).toHaveBeenCalledWith('room-1'))
    expect(screen.queryAllByText('Friday Night Blind')).toHaveLength(0)
  })

  it('does not delete the blind if the host cancels the confirmation', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ name: 'Friday Night Blind' }), participant }])
    renderPage()
    await screen.findAllByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockDeleteBlindRoom).not.toHaveBeenCalled()
    expect(screen.getAllByText('Friday Night Blind').at(-1)).toBeInTheDocument()
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
    await screen.findAllByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    const confirmButton = screen.getByRole('button', { name: 'Delete Blind for Everyone' })
    await userEvent.click(confirmButton)

    const deletingButton = screen.getByRole('button', { name: 'Deleting…' })
    expect(deletingButton).toBeDisabled()
    await userEvent.click(deletingButton)
    expect(mockDeleteBlindRoom).toHaveBeenCalledTimes(1)

    resolveDelete()
    await waitFor(() => expect(screen.queryAllByText('Friday Night Blind')).toHaveLength(0))
  })

  it('keeps the blind visible and shows a retry message if the delete fails', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ name: 'Friday Night Blind' }), participant }])
    mockDeleteBlindRoom.mockRejectedValueOnce(new Error('network error'))
    renderPage()
    await screen.findAllByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    await userEvent.click(screen.getByRole('button', { name: 'Delete Blind for Everyone' }))

    expect(await screen.findByText('We couldn’t delete this blind. Try again.')).toBeInTheDocument()
    expect(screen.getAllByText('Friday Night Blind').at(-1)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Blind for Everyone' })).not.toBeDisabled()
  })

  it('lets a non-host participant remove a blind from just their own list, without deleting it', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([
      { room: room({ name: 'Friday Night Blind', hostUid: 'host-1' }), participant },
    ])
    renderPage()
    await screen.findAllByText('Friday Night Blind')

    await openDeleteConfirm('Friday Night Blind')
    await userEvent.click(screen.getByRole('button', { name: 'Remove From My History' }))

    expect(mockDeleteBlindRoom).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryAllByText('Friday Night Blind')).toHaveLength(0))
    expect(JSON.parse(localStorage.getItem('fip:hiddenBlindRooms:guest-1') ?? '[]')).toEqual(['room-1'])
  })

  it('keeps a hidden blind hidden across a re-render for the same user', async () => {
    localStorage.setItem('fip:hiddenBlindRooms:host-1', JSON.stringify(['room-1']))
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetMyBlindRooms.mockResolvedValue([{ room: room({ name: 'Friday Night Blind' }), participant }])
    renderPage()

    await screen.findByText('No active Blind Rooms.')
    expect(screen.queryAllByText('Friday Night Blind')).toHaveLength(0)
  })
})
