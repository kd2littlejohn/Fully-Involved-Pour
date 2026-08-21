import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OurWhiskeyStoryPage } from './OurWhiskeyStoryPage'

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/friends/u/mike/story']}>
      <Routes>
        <Route path="/friends/u/:username/story" element={<OurWhiskeyStoryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OurWhiskeyStoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: 'me', displayName: 'Kevin' }, loading: false })
    mockUseUserData.mockReturnValue({ profile: { displayName: 'Kevin' } })
  })

  it('shows a not-found state for a bad username', () => {
    mockUseFriendProfile.mockReturnValue({ data: undefined, loading: false, notFound: true })
    mockUseOurWhiskeyStory.mockReturnValue({ story: undefined, loading: false })
    renderPage()
    expect(screen.getByText("We couldn't find that profile.")).toBeInTheDocument()
  })

  it('shows an empty state when nothing has been shared yet', () => {
    mockUseFriendProfile.mockReturnValue({
      data: { uid: 'friend-1', profile: { username: 'mike', displayName: 'Mike Johnson' }, sharedMomentsWithViewer: [] },
      loading: false,
      notFound: false,
    })
    mockUseOurWhiskeyStory.mockReturnValue({
      story: { poursTogetherCount: 0, blindTastingsTogetherCount: 0, recentSharedMoments: [], sharedBlindRooms: [] },
      loading: false,
    })
    renderPage()

    expect(screen.getByRole('heading', { name: /Kevin.*Mike/ })).toBeInTheDocument()
    expect(screen.getByText('Nothing shared yet.')).toBeInTheDocument()
  })

  it('shows real stats, recent shared pours, and shared blind tastings', () => {
    mockUseFriendProfile.mockReturnValue({
      data: { uid: 'friend-1', profile: { username: 'mike', displayName: 'Mike Johnson' }, sharedMomentsWithViewer: [] },
      loading: false,
      notFound: false,
    })
    mockUseOurWhiskeyStory.mockReturnValue({
      story: {
        poursTogetherCount: 14,
        blindTastingsTogetherCount: 5,
        mostSharedBottle: { name: 'Stagg Batch 23', count: 8 },
        recentSharedMoments: [
          {
            id: 'm1',
            storyId: 'p1',
            ownerId: 'friend-1',
            ownerUsername: 'mike',
            participantIds: ['me'],
            acceptedParticipantIds: [],
            snapshot: { bottleName: 'Old Forester 1920', distillery: 'Old Forester', date: '2026-04-28' },
            createdAt: 1,
          },
        ],
        sharedBlindRooms: [
          { id: 'room-1', code: 'ABC123', name: 'Double Oak Showdown', hostUid: 'me', hostUsername: 'kevin', sessionType: 'live', knowledgeMode: 'single', pourCount: 3, state: 'complete', createdAt: 1, participantCount: 2 },
        ],
      },
      loading: false,
    })
    renderPage()

    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('Pours Together')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Blind Tastings')).toBeInTheDocument()
    expect(screen.getByText('Stagg Batch 23')).toBeInTheDocument()
    expect(screen.getByText('Old Forester 1920')).toBeInTheDocument()
    expect(screen.getByText('Double Oak Showdown')).toBeInTheDocument()
  })
})
