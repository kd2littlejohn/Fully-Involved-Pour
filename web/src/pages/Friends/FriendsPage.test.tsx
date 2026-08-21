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
const mockUseSharedBlindActivity = vi.fn()

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

vi.mock('../../features/friends/useSharedBlindActivity', () => ({
  useSharedBlindActivity: (...args: unknown[]) => mockUseSharedBlindActivity(...args),
}))

// FriendBottleQuickView (rendered, unmocked, by FriendsPage) fetches
// friend context of its own when opened — never hit the real network from
// a unit test.
const mockUseFriendBottleQuickView = vi.fn()
vi.mock('../../features/friends/useFriendBottleQuickView', () => ({
  useFriendBottleQuickView: (...args: unknown[]) => mockUseFriendBottleQuickView(...args),
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
  refBottleName: 'Elijah Craig Barrel Proof',
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
    mockUseSharedBlindActivity.mockReturnValue({ items: [], loading: false })
    mockUseFriendBottleQuickView.mockReturnValue({ data: { friendProfile: undefined, bottleFacts: undefined, stories: [] }, loading: false })
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

  it('shows Shared With You cards (led by who shared it), Recent Friend Activity, and Friends Are Pouring from real data', () => {
    mockUseSharedWithYou.mockReturnValue({ items: [{ kind: 'shared-moment', moment }], loading: false, reload: vi.fn() })
    mockUseNotifications.mockReturnValue({ notifications: [notification], unread: 1, loading: false, reload: vi.fn(), markRead: vi.fn() })
    mockUseFriendsPouring.mockReturnValue({ items: [pouringFriend], loading: false })
    renderPage()

    expect(screen.getByText('Shared With You')).toBeInTheDocument()
    // The preview card leads with who shared it, not just the bottle.
    expect(screen.getByText('Kevin Littlejohn')).toBeInTheDocument()
    expect(screen.getByText('shared a Pour Story')).toBeInTheDocument()
    expect(screen.getByText('Stagg Batch 23')).toBeInTheDocument()
    expect(screen.getByText('Recent Friend Activity')).toBeInTheDocument()
    expect(screen.getByText('Mike Johnson reacted to your shared pour')).toBeInTheDocument()
    expect(screen.getByText('Friends Are Pouring')).toBeInTheDocument()
    expect(screen.getByText('Dre')).toBeInTheDocument()
    expect(screen.getByText('Old Forester 1924')).toBeInTheDocument()
  })

  it('includes a real Blind Room completion in Recent Friend Activity', () => {
    mockUseSharedBlindActivity.mockReturnValue({
      items: [
        {
          id: 'blind-room-1-friend-3',
          actorName: 'Dre',
          text: 'You and Dre completed a Blind Room',
          subtitle: 'Double Oak Showdown',
          to: '/blind/room-1/reveal',
          timestamp: Date.now(),
          read: true,
        },
      ],
      loading: false,
    })
    renderPage()

    expect(screen.getByText('You and Dre completed a Blind Room')).toBeInTheDocument()
    expect(screen.getByText('Double Oak Showdown')).toBeInTheDocument()
  })

  it('shows a "Your Friends" quick-access row on the Shared/home tab, without needing a tab switch', () => {
    mockUseFriends.mockReturnValue({
      friends: [{ uid: 'friend-1', username: 'kevin', displayName: 'Kevin Littlejohn' }],
      loading: false,
      reload: vi.fn(),
    })
    renderPage()

    expect(screen.getByText('Your Friends')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kevin Littlejohn' })).toHaveAttribute('href', '/friends/u/kevin')
  })

  it('opens Friend Bottle Quick View — not a navigation — when a Shared With You card is tapped', async () => {
    mockUseSharedWithYou.mockReturnValue({ items: [{ kind: 'shared-moment', moment }], loading: false, reload: vi.fn() })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /Kevin Littlejohn/ }))

    // The quick view sheet, not a route change — Kevin's Take heading only
    // renders inside it.
    expect(screen.getByText('Kevin Littlejohn’s Take')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to Wish List' })).toBeInTheDocument()
  })

  it('opens Friend Bottle Quick View when a bottle-related activity row is tapped', async () => {
    mockUseNotifications.mockReturnValue({ notifications: [notification], unread: 1, loading: false, reload: vi.fn(), markRead: vi.fn() })
    renderPage()

    await userEvent.click(screen.getByText('Mike Johnson reacted to your shared pour'))
    expect(screen.getByText('Mike Johnson’s Take')).toBeInTheDocument()
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
