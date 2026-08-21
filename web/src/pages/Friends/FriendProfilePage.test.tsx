import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { FriendProfilePage } from './FriendProfilePage'
import type { FriendProfileData } from '../../features/friends/useFriendProfile'
import type { Bottle } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockUseFriendProfile = vi.fn()
const mockUseOurWhiskeyStory = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../features/friends/useFriendProfile', () => ({
  useFriendProfile: (...args: unknown[]) => mockUseFriendProfile(...args),
}))

vi.mock('../../features/friends/useOurWhiskeyStory', () => ({
  useOurWhiskeyStory: (...args: unknown[]) => mockUseOurWhiskeyStory(...args),
}))

vi.mock('../../features/friends/AddFriendButton', () => ({
  AddFriendButton: () => <button type="button">Add Friend</button>,
}))

function myBottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'name' | 'status'>): Bottle {
  return overrides
}

function renderPage(
  friendData: FriendProfileData | undefined,
  myBottles: Bottle[] = [],
  ourWhiskeyStory: { story: unknown; loading: boolean } = { story: undefined, loading: false },
) {
  mockUseAuth.mockReturnValue({ user: { uid: 'viewer-uid' }, loading: false })
  mockUseUserData.mockReturnValue({
    userDoc: { bottles: myBottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
  })
  mockUseFriendProfile.mockReturnValue({ data: friendData, loading: false, notFound: !friendData })
  mockUseOurWhiskeyStory.mockReturnValue(ourWhiskeyStory)

  return render(
    <MemoryRouter initialEntries={['/friends/u/kevin']}>
      <Routes>
        <Route path="/friends/u/:username" element={<FriendProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FriendProfilePage — shared bottle detail', () => {
  it('shows distillery, type/proof/age, and a status badge for a bottle the friend is sharing — not just image and name', () => {
    renderPage({
      uid: 'friend-uid',
      profile: { username: 'kevin', displayName: 'Kevin Littlejohn' },
      sharedCollection: {
        uid: 'friend-uid',
        bottles: [
          {
            id: 'b1',
            name: 'Eagle Rare 10 Year',
            distillery: 'Buffalo Trace',
            status: 'open',
            type: 'Bourbon',
            proof: 90,
            ageStatement: '10 Year',
          },
        ],
        wishlist: [],
        updatedAt: 1,
      },
      sharedMomentsWithViewer: [],
    })

    expect(screen.getByText('Eagle Rare 10 Year')).toBeInTheDocument()
    expect(screen.getByText('Buffalo Trace')).toBeInTheDocument()
    expect(screen.getByText('Bourbon · 90 proof · 10 Year')).toBeInTheDocument()
    expect(screen.getByText('Opened')).toBeInTheDocument()
  })

  it('does not show a redundant status badge on wish list items', () => {
    renderPage({
      uid: 'friend-uid',
      profile: { username: 'kevin', displayName: 'Kevin Littlejohn' },
      sharedCollection: {
        uid: 'friend-uid',
        bottles: [],
        wishlist: [{ id: 'w1', name: 'Pappy Van Winkle 15', status: 'wishlist' }],
        updatedAt: 1,
      },
      sharedMomentsWithViewer: [],
    })

    expect(screen.getByText('Pappy Van Winkle 15')).toBeInTheDocument()
    expect(screen.queryByText('Wishlist')).not.toBeInTheDocument()
  })

  it('shows the viewer’s own richer detail (type/proof/age/status) for a bottle both people own', () => {
    renderPage(
      {
        uid: 'friend-uid',
        profile: { username: 'kevin', displayName: 'Kevin Littlejohn' },
        sharedCollection: {
          uid: 'friend-uid',
          bottles: [{ id: 'b1', name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', status: 'open' }],
          wishlist: [],
          updatedAt: 1,
        },
        sharedMomentsWithViewer: [],
      },
      [
        myBottle({
          id: 'mine-1',
          name: 'Eagle Rare 10 Year',
          distillery: 'Buffalo Trace',
          status: 'sealed',
          type: 'Bourbon',
          proof: 90,
          ageStatement: '10 Year',
        }),
      ],
    )

    expect(screen.getByText('Bottles We Both Own')).toBeInTheDocument()
    // My own copy is sealed, not open — the common-bottle tile should
    // reflect MY status, not the friend's, since it's drawn from my own
    // private bottle data.
    expect(screen.getByText('Sealed')).toBeInTheDocument()
    expect(screen.getByText('Bourbon · 90 proof · 10 Year')).toBeInTheDocument()
  })

  it('omits price, store, notes, and other personal fields entirely — they were never in the projection to begin with', () => {
    renderPage({
      uid: 'friend-uid',
      profile: { username: 'kevin', displayName: 'Kevin Littlejohn' },
      sharedCollection: {
        uid: 'friend-uid',
        bottles: [{ id: 'b1', name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', status: 'open' }],
        wishlist: [],
        updatedAt: 1,
      },
      sharedMomentsWithViewer: [],
    })

    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('shows real shared blind tastings, not just a count, linking through to the full Our Whiskey Story', () => {
    renderPage(
      {
        uid: 'friend-uid',
        profile: { username: 'kevin', displayName: 'Kevin Littlejohn' },
        sharedMomentsWithViewer: [],
      },
      [],
      {
        story: {
          poursTogetherCount: 3,
          blindTastingsTogetherCount: 1,
          recentSharedMoments: [],
          sharedBlindRooms: [
            {
              id: 'room-1',
              code: 'ABC123',
              name: 'Double Oak Showdown',
              hostUid: 'viewer-uid',
              hostUsername: 'viewer',
              sessionType: 'live',
              knowledgeMode: 'single',
              pourCount: 3,
              state: 'completed',
              createdAt: 1,
              completedAt: 1,
              participantCount: 2,
            },
          ],
        },
        loading: false,
      },
    )

    expect(screen.getByText('Shared Blind Tastings')).toBeInTheDocument()
    expect(screen.getByText('Double Oak Showdown')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See All' })).toHaveAttribute('href', '/friends/u/kevin/story')
  })
})
