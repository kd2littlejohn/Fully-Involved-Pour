import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DiscoverPage } from './DiscoverPage'
import type { Bottle, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockAddBottle = vi.fn().mockResolvedValue(undefined)
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

function renderDiscover() {
  return render(
    <MemoryRouter>
      <DiscoverPage />
    </MemoryRouter>,
  )
}

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open', rating: 8.5, createdAt: 1 },
  { id: 'b2', name: 'Pappy 15', distillery: 'Old Rip Van Winkle', status: 'wishlist', createdAt: 2 },
]

const pours: Pour[] = []

describe('DiscoverPage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: false,
    })
    renderDiscover()
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('shows the empty state when signed in with no bottles', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
    })
    renderDiscover()
    expect(screen.getByText("Add a few bottles and we'll start suggesting what to try next.")).toBeInTheDocument()
  })

  it('shows Buy Next, Top Rated, and Your Distilleries from real data, and honest deferred states for the rest', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderDiscover()

    expect(screen.getByText('Pappy 15')).toBeInTheDocument() // Buy Next
    expect(screen.getByText('Eagle Rare')).toBeInTheDocument() // Top Rated
    expect(screen.getByText('Favorite Distillery')).toBeInTheDocument()
    expect(screen.getAllByText('Buffalo Trace').length).toBeGreaterThan(0)
    expect(screen.getByText('Recommended for You')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Get AI Recommendations/ })).toBeInTheDocument()
    expect(screen.getAllByText('Not available yet.')).toHaveLength(3) // New Releases/Trending/Nearby Stores
  })

  it('navigates to the Add Bottle page with wishlist status preselected via Add to Wishlist', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [], people: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderDiscover()

    await userEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))

    expect(mockNavigate).toHaveBeenCalledWith('/bottles/new', { state: { defaultStatus: 'wishlist' } })
  })
})
