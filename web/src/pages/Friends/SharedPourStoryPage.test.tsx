import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SharedPourStoryPage } from './SharedPourStoryPage'

const mockUseAuth = vi.fn()
const mockUseSharedPourStory = vi.fn()
const mockAcceptSharedMoment = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../features/friends/useSharedPourStory', () => ({
  useSharedPourStory: (...args: unknown[]) => mockUseSharedPourStory(...args),
}))

vi.mock('../../data/repositories/sharedMoments', () => ({
  acceptSharedMoment: (...args: unknown[]) => mockAcceptSharedMoment(...args),
}))

vi.mock('../../features/friends/ReactionBar', () => ({
  ReactionBar: () => <div>Reaction bar</div>,
}))

vi.mock('../../features/friends/CommentsList', () => ({
  CommentsList: () => <div>Comments list</div>,
}))

// FriendBottleQuickView (rendered, unmocked, by SharedPourStoryPage) fetches
// friend context of its own when opened — never hit the real network from
// a unit test.
const mockUseFriendBottleQuickView = vi.fn()
vi.mock('../../features/friends/useFriendBottleQuickView', () => ({
  useFriendBottleQuickView: (...args: unknown[]) => mockUseFriendBottleQuickView(...args),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/friends/shared/moment-1']}>
      <Routes>
        <Route path="/friends/shared/:momentId" element={<SharedPourStoryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const moment = {
  id: 'moment-1',
  storyId: 'p1',
  ownerId: 'friend-1',
  ownerUsername: 'kevin',
  ownerDisplayName: 'Kevin Littlejohn',
  participantIds: ['me', 'friend-2'],
  acceptedParticipantIds: [],
  snapshot: {
    bottleName: 'Stagg Batch 23',
    distillery: 'Buffalo Trace',
    rating: 8.7,
    memory: 'Great night on the porch.',
    date: '2026-01-01',
  },
  createdAt: Date.now(),
}

const people = [
  { uid: 'friend-1', username: 'kevin', displayName: 'Kevin Littlejohn' },
  { uid: 'me', username: 'viewer', displayName: 'Viewer' },
  { uid: 'friend-2', username: 'mike', displayName: 'Mike Johnson' },
]

describe('SharedPourStoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: 'me' }, loading: false })
    mockUseFriendBottleQuickView.mockReturnValue({ data: { friendProfile: undefined, bottleFacts: undefined, stories: [] }, loading: false })
  })

  it('shows a not-found state when the story does not exist or is not shared with the viewer', () => {
    mockUseSharedPourStory.mockReturnValue({ data: undefined, loading: false, notFound: true })
    renderPage()
    expect(screen.getByText("We couldn't find that story.")).toBeInTheDocument()
  })

  it('renders the bottle, story text, participants, score, and reactions/comments', () => {
    mockUseSharedPourStory.mockReturnValue({ data: { moment, people }, loading: false, notFound: false })
    renderPage()

    expect(screen.getByText('Stagg Batch 23')).toBeInTheDocument()
    expect(screen.getByText('Buffalo Trace')).toBeInTheDocument()
    expect(screen.getByText('Great night on the porch.')).toBeInTheDocument()
    expect(screen.getByText('8.7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kevin Littlejohn' })).toHaveAttribute('href', '/friends/u/kevin')
    expect(screen.getByRole('link', { name: 'Mike Johnson' })).toHaveAttribute('href', '/friends/u/mike')
    expect(screen.getByText('Reaction bar')).toBeInTheDocument()
    expect(screen.getByText('Comments list')).toBeInTheDocument()
  })

  it('opens Friend Bottle Quick View when the bottle info is tapped', async () => {
    mockUseSharedPourStory.mockReturnValue({ data: { moment, people }, loading: false, notFound: false })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /Stagg Batch 23/ }))

    expect(screen.getByText('Kevin Littlejohn’s Take')).toBeInTheDocument()
  })

  it('lets a tagged participant who has not accepted yet add it to their shared memories', async () => {
    mockUseSharedPourStory.mockReturnValue({ data: { moment, people }, loading: false, notFound: false })
    renderPage()

    const button = screen.getByRole('button', { name: 'Add to My Shared Memories' })
    await userEvent.click(button)
    expect(mockAcceptSharedMoment).toHaveBeenCalledWith('moment-1', 'me')
  })

  it('does not show the accept button once the viewer has already accepted', () => {
    mockUseSharedPourStory.mockReturnValue({
      data: { moment: { ...moment, acceptedParticipantIds: ['me'] }, people },
      loading: false,
      notFound: false,
    })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Add to My Shared Memories' })).not.toBeInTheDocument()
  })
})
