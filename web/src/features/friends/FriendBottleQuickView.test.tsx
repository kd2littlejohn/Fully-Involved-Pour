import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FriendBottleQuickView, type FriendBottleQuickViewTarget } from './FriendBottleQuickView'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockUseFriendBottleQuickView = vi.fn()
const mockAddBottle = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('./useFriendBottleQuickView', () => ({
  useFriendBottleQuickView: (...args: unknown[]) => mockUseFriendBottleQuickView(...args),
}))

vi.mock('./RecommendToFriendModal', () => ({
  RecommendToFriendModal: () => <div>Recommend modal</div>,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const baseTarget: FriendBottleQuickViewTarget = {
  friendUid: 'friend-1',
  friendName: 'Mike Johnson',
  friendUsername: 'mike',
  bottleName: 'Stagg Batch 23',
  distillery: 'Buffalo Trace',
  imageUrl: 'https://example.com/stagg.jpg',
  type: 'Bourbon',
  proof: 128.1,
  ageStatement: undefined,
  status: 'open',
  take: {
    score: 9.3,
    averageScore: 9.1,
    latestTake: 'Rich caramel, cherry and oak. Hot at first but opens up beautifully.',
    buyAgain: 'absolutely',
    wouldReplace: 'yes',
    noseNotes: ['Caramel', 'Vanilla', 'Dark Fruit'],
    palateNotes: ['Cherry', 'Oak', 'Brown Sugar'],
    finishNotes: ['Long', 'Warm', 'Spicy'],
    topNotes: ['Caramel', 'Cherry', 'Oak', 'Vanilla'],
    evolvingTerm: 'Oak',
    pourCount: 5,
    lastPourDate: '2026-03-15',
  },
}

function renderQuickView(target: FriendBottleQuickViewTarget | undefined, myBottles: unknown[] = []) {
  mockUseAuth.mockReturnValue({ user: { uid: 'me' }, loading: false })
  mockUseUserData.mockReturnValue({
    userDoc: { bottles: myBottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
    profile: { whiskeyIdentityTags: [] },
    addBottle: mockAddBottle,
  })
  mockUseFriendBottleQuickView.mockReturnValue({ data: { friendProfile: undefined, bottleFacts: undefined, stories: [] }, loading: false })

  return render(
    <MemoryRouter>
      <FriendBottleQuickView target={target} onClose={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('FriendBottleQuickView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddBottle.mockResolvedValue('new-bottle-id')
  })

  it('renders nothing when there is no target — never opens without a real tap', () => {
    renderQuickView(undefined)
    expect(screen.queryByText('Stagg Batch 23')).not.toBeInTheDocument()
  })

  it('shows the correct bottle facts and the friend’s take when tapped', () => {
    renderQuickView(baseTarget)

    expect(screen.getAllByText('Stagg Batch 23').length).toBeGreaterThan(0)
    expect(screen.getByText('Buffalo Trace')).toBeInTheDocument()
    expect(screen.getByText('Bourbon · 128.1 proof')).toBeInTheDocument()
    expect(screen.getByText('Mike Johnson’s Take')).toBeInTheDocument()
    expect(screen.getByText('9.3')).toBeInTheDocument()
    expect(screen.getByText('Avg 9.1')).toBeInTheDocument()
    expect(screen.getByText('“Rich caramel, cherry and oak. Hot at first but opens up beautifully.”')).toBeInTheDocument()
    expect(screen.getByText('Absolutely')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText(/5 Pours Logged · Last poured Mar 1[45], 2026/)).toBeInTheDocument()
  })

  it('shows structured Tasting Notes by category, Top Notes, and a dynamic summary sentence', () => {
    renderQuickView(baseTarget)

    expect(screen.getByText('Tasting Notes')).toBeInTheDocument()
    expect(screen.getByText('Nose')).toBeInTheDocument()
    expect(screen.getByText('Caramel · Vanilla · Dark Fruit')).toBeInTheDocument()
    expect(screen.getByText('Palate')).toBeInTheDocument()
    expect(screen.getByText('Cherry · Oak · Brown Sugar')).toBeInTheDocument()
    expect(screen.getByText('Finish')).toBeInTheDocument()
    expect(screen.getByText('Long · Warm · Spicy')).toBeInTheDocument()

    expect(screen.getByText('Top Notes')).toBeInTheDocument()
    expect(screen.getAllByText('Caramel').length).toBeGreaterThan(0)

    // The dynamic summary — generated from the same real data above, not a
    // static stored sentence.
    expect(
      screen.getByText('Based on 5 pours, Mike Johnson consistently finds caramel, cherry, oak, and vanilla, with a long, warm, and spicy finish.'),
    ).toBeInTheDocument()
  })

  it('shows a bottle-evolution insight only when the underlying data supports one', () => {
    renderQuickView(baseTarget)
    expect(screen.getByText('More Oak')).toBeInTheDocument()
    expect(screen.getByText('Oak has come up more consistently in the last few pours.')).toBeInTheDocument()
  })

  it('does not show an evolution insight when there is no evolving term', () => {
    renderQuickView({ ...baseTarget, take: { ...baseTarget.take!, evolvingTerm: undefined } })
    expect(screen.queryByText(/^More /)).not.toBeInTheDocument()
  })

  it('only shows tasting-note categories that have real data — never an empty "Finish" label', () => {
    renderQuickView({
      ...baseTarget,
      take: { score: 9.0, noseNotes: ['Caramel'], pourCount: 1 },
    })
    expect(screen.getByText('Nose')).toBeInTheDocument()
    expect(screen.queryByText('Palate')).not.toBeInTheDocument()
    expect(screen.queryByText('Finish')).not.toBeInTheDocument()
  })

  it('respects privacy — shows no take at all when the friend has not opted pour stories into "friends"', () => {
    renderQuickView({ ...baseTarget, take: undefined })
    expect(screen.getByText('Mike Johnson hasn’t shared their take on this bottle yet.')).toBeInTheDocument()
    expect(screen.queryByText('Absolutely')).not.toBeInTheDocument()
    expect(screen.queryByText('Tasting Notes')).not.toBeInTheDocument()
  })

  it('offers Add to Wish List when the viewer does not own the bottle, and calls addBottle', async () => {
    renderQuickView(baseTarget, [])
    const button = screen.getByRole('button', { name: 'Add to Wish List' })
    await userEvent.click(button)

    expect(mockAddBottle).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Stagg Batch 23', distillery: 'Buffalo Trace', status: 'wishlist' }),
    )
  })

  it('shows "On Wish List" (disabled) when the viewer already wishlisted it', () => {
    renderQuickView(baseTarget, [{ id: 'mine-1', name: 'Stagg Batch 23', distillery: 'Buffalo Trace', status: 'wishlist' }])
    const button = screen.getByRole('button', { name: 'On Wish List' })
    expect(button).toBeDisabled()
  })

  it('shows View in My Bar and navigates to the viewer’s own bottle when they already own it', async () => {
    renderQuickView(baseTarget, [{ id: 'mine-1', name: 'Stagg Batch 23', distillery: 'Buffalo Trace', status: 'open' }])
    await userEvent.click(screen.getByRole('button', { name: 'View in My Bar' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/mine-1')
  })

  it('shows and filters See Pour Stories to only this bottle’s shared stories', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'me' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      profile: { whiskeyIdentityTags: [] },
      addBottle: mockAddBottle,
    })
    mockUseFriendBottleQuickView.mockReturnValue({
      data: {
        friendProfile: undefined,
        bottleFacts: undefined,
        stories: [
          {
            id: 'moment-1',
            storyId: 'p1',
            ownerId: 'friend-1',
            ownerUsername: 'mike',
            participantIds: ['me'],
            acceptedParticipantIds: [],
            snapshot: { bottleName: 'Stagg Batch 23', date: '2026-03-15', rating: 9.3, memory: 'Great porch pour.' },
            createdAt: 1,
          },
        ],
      },
      loading: false,
    })

    render(
      <MemoryRouter>
        <FriendBottleQuickView target={baseTarget} onClose={vi.fn()} />
      </MemoryRouter>,
    )

    const seeStoriesButton = screen.getByRole('button', { name: /Pour Stories/ })
    expect(screen.queryByText('Great porch pour.')).not.toBeInTheDocument()
    await userEvent.click(seeStoriesButton)
    expect(screen.getByText('Great porch pour.')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Great porch pour.').closest('button')!)
    expect(mockNavigate).toHaveBeenCalledWith('/friends/shared/moment-1')
  })
})
