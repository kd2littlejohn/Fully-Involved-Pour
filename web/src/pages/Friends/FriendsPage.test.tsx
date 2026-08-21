import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FriendsPage } from './FriendsPage'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockUseFriends = vi.fn()
const mockUseFriendRequests = vi.fn()
const mockUseSharedWithYou = vi.fn()
const mockUseNotifications = vi.fn()
const mockUseFriendsPouring = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

// FriendRequestCard's outgoing branch fetches the receiver's profile
// directly — never hit the real network from a unit test.
vi.mock('../../data/repositories/profile', () => ({
  fetchProfile: () => Promise.resolve({ username: 'friend2', displayName: 'Friend Two' }),
}))

vi.mock('../../features/friends/useFriends', () => ({
  useFriends: (...args: unknown[]) => mockUseFriends(...args),
}))

vi.mock('../../features/friends/useFriendRequests', () => ({
  useFriendRequests: (...args: unknown[]) => mockUseFriendRequests(...args),
}))

vi.mock('../../features/friends/useSharedWithYou', () => ({
  useSharedWithYou: (...args: unknown[]) => mockUseSharedWithYou(...args),
}))

vi.mock('../../features/friends/useNotifications', () => ({
  useNotifications: (...args: unknown[]) => mockUseNotifications(...args),
}))

vi.mock('../../features/friends/useFriendsPouring', () => ({
  useFriendsPouring: (...args: unknown[]) => mockUseFriendsPouring(...args),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/friends']}>
      <FriendsPage />
    </MemoryRouter>,
  )
}

const moment = {
  id: 'moment-1',
  storyId: 'p1',
  ownerId: 'friend-1',
  ownerUsername: 'kevin',
  ownerDisplayName: 'Kevin Littlejohn',
  participantIds: ['me'],
  acceptedParticipantIds: [],
  snapshot: { bottleName: 'Stagg Batch 23', distillery: 'Buffalo Trace', date: '2026-01-01' },
  createdAt: Date.now(),
}

const notification = {
  id: 'notif-1',
  recipientId: 'me',
  type: 'story-reaction' as const,
  actorId: 'friend-2',
  actorUsername: 'mike',
  actorDisplayName: 'Mike Johnson',
  refId: 'moment-1',
  read: false,
  createdAt: Date.now(),
}

const pouringFriend = { uid: 'friend-3', displayName: 'Dre', username: 'dre', bottleName: 'Old Forester 1924' }

describe('FriendsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: 'me' }, loading: false })
    mockUseUserData.mockReturnValue({ userDoc: { username: 'me', bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] }, profile: undefined })
    mockUseFriends.mockReturnValue({ friends: [], loading: false, reload: vi.fn() })
    mockUseFriendRequests.mockReturnValue({ incoming: [], outgoing: [], loading: false, reload: vi.fn() })
    mockUseSharedWithYou.mockReturnValue({ items: [], loading: false, reload: vi.fn() })
    mockUseNotifications.mockReturnValue({ notifications: [], unread: 0, loading: false, reload: vi.fn(), markRead: vi.fn() })
    mockUseFriendsPouring.mockReturnValue({ items: [], loading: false })
  })

  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderPage()
    expect(screen.getByText('Sign in to continue.')).toBeInTheDocument()
  })

  it('renders the header with a Find Friends link and a Requests badge showing the incoming count', () => {
    mockUseFriendRequests.mockReturnValue({ incoming: [{ id: 'r1' }, { id: 'r2' }], outgoing: [], loading: false, reload: vi.fn() })
    renderPage()

    expect(screen.getByRole('link', { name: 'Find Friends' })).toHaveAttribute('href', '/friends/add')
    const requestsButton = screen.getByRole('button', { name: 'Friend Requests' })
    expect(within(requestsButton).getByText('2')).toBeInTheDocument()
  })

  it('shows an empty state on Shared when nothing is shared, no activity, and no friends pouring', () => {
    renderPage()
    expect(screen.getByText('Nothing shared yet.')).toBeInTheDocument()
  })

  it('shows Shared With You cards, Recent Friend Activity, and Friends Are Pouring from real data', () => {
    mockUseSharedWithYou.mockReturnValue({ items: [{ kind: 'shared-moment', moment }], loading: false, reload: vi.fn() })
    mockUseNotifications.mockReturnValue({ notifications: [notification], unread: 1, loading: false, reload: vi.fn(), markRead: vi.fn() })
    mockUseFriendsPouring.mockReturnValue({ items: [pouringFriend], loading: false })
    renderPage()

    expect(screen.getByText('Shared With You')).toBeInTheDocument()
    expect(screen.getByText('Stagg Batch 23')).toBeInTheDocument()
    expect(screen.getByText('Recent Friend Activity')).toBeInTheDocument()
    expect(screen.getByText('Mike Johnson reacted to your shared pour')).toBeInTheDocument()
    expect(screen.getByText('Friends Are Pouring')).toBeInTheDocument()
    expect(screen.getByText('Dre')).toBeInTheDocument()
    expect(screen.getByText('Old Forester 1924')).toBeInTheDocument()
  })

  it('reveals the full actionable list for Shared With You only after "See All" is tapped', async () => {
    mockUseSharedWithYou.mockReturnValue({ items: [{ kind: 'shared-moment', moment }], loading: false, reload: vi.fn() })
    renderPage()

    // The full SharedMomentCard renders "shared a Pour Story with you" as
    // its own header text — a second, distinct occurrence from the preview
    // card's eyebrow — only once expanded.
    expect(screen.queryByText('shared a Pour Story with you')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'See All' }))
    expect(screen.getByText('shared a Pour Story with you')).toBeInTheDocument()
  })

  it('switches between Incoming and Outgoing on the Requests tab', async () => {
    mockUseFriendRequests.mockReturnValue({
      incoming: [{ id: 'r1', senderId: 'friend-1', senderUsername: 'kevin', senderDisplayName: 'Kevin', receiverId: 'me', status: 'pending', createdAt: 1, updatedAt: 1 }],
      outgoing: [{ id: 'r2', senderId: 'me', senderUsername: 'you', senderDisplayName: 'You', receiverId: 'friend-2', status: 'pending', createdAt: 1, updatedAt: 1 }],
      loading: false,
      reload: vi.fn(),
    })
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: /Requests/ }))

    expect(screen.getByRole('tab', { name: 'Incoming' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Kevin')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Outgoing' }))
    expect(screen.queryByText('Kevin')).not.toBeInTheDocument()
  })

  it('still renders the Friends tab with real friend cards', async () => {
    mockUseFriends.mockReturnValue({
      friends: [{ uid: 'friend-1', username: 'kevin', displayName: 'Kevin Littlejohn' }],
      loading: false,
      reload: vi.fn(),
    })
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Friends' }))
    expect(screen.getByText('Kevin Littlejohn')).toBeInTheDocument()
  })
})
