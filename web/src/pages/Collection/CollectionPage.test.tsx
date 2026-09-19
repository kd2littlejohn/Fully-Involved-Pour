import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CollectionPage } from './CollectionPage'
import type { Bottle } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockAddBottle = vi.fn().mockResolvedValue(undefined)
const mockDeleteBottles = vi.fn().mockResolvedValue(undefined)
const mockNavigate = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderCollection(initialEntries: string[] = ['/collection']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CollectionPage />
    </MemoryRouter>,
  )
}

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open', distillery: 'Buffalo Trace', createdAt: 1 },
  { id: 'b2', name: 'Weller 12', status: 'sealed', distillery: 'Buffalo Trace', createdAt: 2 },
  { id: 'b3', name: 'Pappy 15 (wishlist)', status: 'wishlist', distillery: 'Old Rip Van Winkle', createdAt: 3 },
  { id: 'b4', name: 'Favorite Pick', status: 'sealed', favorite: true, createdAt: 4 },
  { id: 'b5', name: 'Elmer T. Lee', status: 'incoming', createdAt: 5 },
]

describe('CollectionPage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: false,
      addBottle: mockAddBottle,
    })

    renderCollection()

    expect(screen.getByText('Your whiskey journey starts here.')).toBeInTheDocument()
  })

  it('offers an Explore Whiskey link into Discover from the toolbar', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })

    renderCollection()

    const discoverLink = screen.getByRole('link', { name: 'Explore Whiskey' })
    expect(discoverLink).toHaveAttribute('href', expect.stringContaining('/discover'))
  })

  it('deep-links into the Opened filter via ?filter=open, for Home\'s Open Bottles "View All"', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })

    renderCollection(['/collection?filter=open'])

    expect(screen.getByRole('button', { name: 'Opened (1)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All (5)' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters the grid by status when a chip is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })

    renderCollection()

    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.getByText('Weller 12')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Sealed \(2\)/ }))

    expect(screen.getByText('Weller 12')).toBeInTheDocument()
    expect(screen.getByText('Favorite Pick')).toBeInTheDocument()
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument()
    expect(screen.queryByText(/Pappy 15/)).not.toBeInTheDocument()
  })

  it('filters to incoming bottles', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })

    renderCollection()

    await userEvent.click(screen.getByRole('button', { name: /Incoming \(1\)/ }))

    expect(screen.getByText('Elmer T. Lee')).toBeInTheDocument()
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument()
  })

  it('searches by bottle name', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.type(screen.getByLabelText('Search your bar'), 'eagle')

    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()
  })

  it('searches by distillery', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.type(screen.getByLabelText('Search your bar'), 'buffalo trace')

    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.getByText('Weller 12')).toBeInTheDocument()
    expect(screen.queryByText(/Pappy 15/)).not.toBeInTheDocument()
  })

  it('combines search with the active status filter and updates chip counts', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.type(screen.getByLabelText('Search your bar'), 'buffalo trace')
    await userEvent.click(screen.getByRole('button', { name: /Sealed \(1\)/ }))

    expect(screen.getByText('Weller 12')).toBeInTheDocument()
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument() // open, not sealed
    expect(screen.queryByText('Favorite Pick')).not.toBeInTheDocument() // sealed, but no distillery match
  })

  it('shows a "no matches" empty state for a search with no results', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.type(screen.getByLabelText('Search your bar'), 'nonexistent bottle')

    expect(screen.getByText('No bottles match "nonexistent bottle".')).toBeInTheDocument()
  })

  it('navigates to the Add Bottle page when Add a Bottle is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })

    renderCollection()

    await userEvent.click(screen.getByRole('button', { name: 'Add a Bottle' }))

    expect(mockNavigate).toHaveBeenCalledWith('/bottles/new')
  })

  it('switches between grid and list view', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    // Grid view by default — status renders as a Badge.
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'List view' }))

    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByText('Eagle Rare').length).toBeGreaterThan(0)
  })

  it('selects all and bulk-deletes with confirmation', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
      deleteBottles: mockDeleteBottles,
    })
    renderCollection()

    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    await userEvent.click(screen.getByRole('button', { name: 'Select All' }))
    expect(screen.getByText('5 selected')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Selected' }))
    expect(screen.getByText('Delete 5 bottles?')).toBeInTheDocument()
    expect(mockDeleteBottles).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))
    expect(mockDeleteBottles).toHaveBeenCalledWith(['b1', 'b2', 'b3', 'b4', 'b5'])
  })

  it('sorts bottles by name when a sort option is chosen', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.selectOptions(screen.getByLabelText('Sort bottles'), 'name-asc')

    const hrefs = screen.getAllByRole('link').map((el) => el.getAttribute('href') ?? '')
    const eagleIndex = hrefs.indexOf('/collection/b1') // Eagle Rare
    const wellerIndex = hrefs.indexOf('/collection/b2') // Weller 12
    expect(eagleIndex).toBeGreaterThanOrEqual(0)
    expect(eagleIndex).toBeLessThan(wellerIndex)
  })

  it('selects individual bottles by clicking their card', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
      deleteBottles: mockDeleteBottles,
    })
    renderCollection()

    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Eagle Rare' }))

    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Eagle Rare' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('CollectionPage — rarity chart and filter', () => {
  const rarityBottles: Bottle[] = [
    { id: 'r1', name: 'Eagle Rare', status: 'open', distillery: 'Buffalo Trace', createdAt: 1, rarity: 'rare', raritySource: 'manual' },
    { id: 'r2', name: 'Weller 12', status: 'sealed', distillery: 'Buffalo Trace', createdAt: 2, rarity: 'common', raritySource: 'manual' },
    { id: 'r3', name: 'Unclassified Bottle', status: 'sealed', createdAt: 3 },
    { id: 'r4', name: 'Pappy 15 (wishlist)', status: 'wishlist', createdAt: 4, rarity: 'unicorn', raritySource: 'manual' },
    { id: 'r5', name: 'Pending Bottle', status: 'open', createdAt: 5, raritySuggestion: { rarity: 'rare', confidence: 'high', reason: 'x', identityKey: 'k', generatedAt: 1, classifierVersion: 'rarity-v1' } },
  ]

  function renderWithRarityBottles() {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: rarityBottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    return renderCollection()
  }

  function legend() {
    return within(screen.getByTestId('rarity-legend'))
  }

  it('the chart total excludes wishlist bottles (Pappy 15) even though it has a confirmed rarity', () => {
    renderWithRarityBottles()
    // 4 owned bottles (r1, r2, r3, r5) out of 5 total — r4 is wishlist and excluded.
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('clicking the Rare legend row filters the list to only Rare bottles', async () => {
    renderWithRarityBottles()
    await userEvent.click(legend().getByRole('button', { name: /^Rare:/ }))

    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()
    expect(screen.queryByText('Unclassified Bottle')).not.toBeInTheDocument()
  })

  it('clicking Unclassified shows bottles without confirmed rarity, including one with a pending suggestion', async () => {
    renderWithRarityBottles()
    await userEvent.click(legend().getByRole('button', { name: /^Unclassified:/ }))

    expect(screen.getByText('Unclassified Bottle')).toBeInTheDocument()
    expect(screen.getByText('Pending Bottle')).toBeInTheDocument()
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument()
  })

  it('clicking the active row again clears the rarity filter', async () => {
    renderWithRarityBottles()
    await userEvent.click(legend().getByRole('button', { name: /^Rare:/ }))
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()

    await userEvent.click(legend().getByRole('button', { name: /^Rare:/ }))
    expect(screen.getByText('Weller 12')).toBeInTheDocument()
  })

  it('"All Bottles" clears the rarity filter', async () => {
    renderWithRarityBottles()
    await userEvent.click(legend().getByRole('button', { name: /^Rare:/ }))
    await userEvent.click(screen.getByRole('button', { name: 'All Bottles' }))
    expect(screen.getByText('Weller 12')).toBeInTheDocument()
  })

  it('selecting a different rarity switches the filter rather than combining additively', async () => {
    renderWithRarityBottles()
    await userEvent.click(legend().getByRole('button', { name: /^Rare:/ }))
    await userEvent.click(legend().getByRole('button', { name: /^Common:/ }))

    expect(screen.getByText('Weller 12')).toBeInTheDocument()
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument()
  })

  it('the rarity filter combines with search (AND, not OR)', async () => {
    renderWithRarityBottles()
    await userEvent.click(legend().getByRole('button', { name: /^Common:/ }))
    await userEvent.type(screen.getByLabelText('Search your bar'), 'weller')
    expect(screen.getByText('Weller 12')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Search your bar'))
    await userEvent.type(screen.getByLabelText('Search your bar'), 'eagle')
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()
    // Eagle Rare is Rare, not Common — the AND of search+rarity matches
    // nothing; the rarity-scoped zero-results message takes precedence.
    expect(screen.getByText('No bottles match Common right now.')).toBeInTheDocument()
  })

  it('the rarity filter combines with an existing status filter', async () => {
    renderWithRarityBottles()
    await userEvent.click(screen.getByRole('button', { name: /Sealed \(2\)/ }))
    await userEvent.click(legend().getByRole('button', { name: /^Rare:/ }))

    // Eagle Rare is Rare but status 'open', not 'sealed' — excluded by the AND.
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument()
  })

  it('shows a rarity-specific zero-results state when nothing matches', async () => {
    renderWithRarityBottles()
    await userEvent.click(legend().getByRole('button', { name: /^Allocated:/ }))
    expect(screen.getByText('No bottles match Allocated right now.')).toBeInTheDocument()
  })

  it('shows the visible result count once a rarity filter is active', async () => {
    renderWithRarityBottles()
    await userEvent.click(legend().getByRole('button', { name: /^Rare:/ }))
    expect(screen.getByText(/Showing 1 bottle · Rare/)).toBeInTheDocument()
  })

  it('shows the "Review Rarity Suggestions" action only when there are eligible Unclassified bottles', () => {
    renderWithRarityBottles()
    expect(screen.getByRole('button', { name: 'Review Rarity Suggestions' })).toBeInTheDocument()
  })

  it('hides "Review Rarity Suggestions" when every owned bottle is already classified', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: {
        bottles: [{ id: 'r1', name: 'Eagle Rare', status: 'open', createdAt: 1, rarity: 'rare', raritySource: 'manual' }],
        pours: [],
        memories: [],
        infinityBottles: [],
        customLibrary: [],
        people: [],
      },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()
    expect(screen.queryByRole('button', { name: 'Review Rarity Suggestions' })).not.toBeInTheDocument()
  })
})
