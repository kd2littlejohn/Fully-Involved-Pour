import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import type { Bottle, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: false,
    })

    renderHome()

    expect(screen.getByText('Your whiskey journey starts here.')).toBeInTheDocument()
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('shows the add-a-bottle empty state when signed in with no bottles', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
    })

    renderHome()

    expect(screen.getByText('Add a bottle to begin building your bar.')).toBeInTheDocument()
  })

  it('renders bottles and pour stories when data is present', () => {
    const bottle: Bottle = {
      id: 'b1',
      name: 'Eagle Rare',
      distillery: 'Buffalo Trace',
      status: 'open',
      createdAt: 1,
    }
    const pour: Pour = {
      id: 'p1',
      bottleId: 'b1',
      date: '2026-07-01',
      rating: 8.6,
      fip: {
        nose: 2,
        palate: 3,
        finish: 1.6,
        complexity: 1,
        value: 1,
        total: 8.6,
        noseAromas: [],
        palateFlavors: [],
      },
    }

    mockUseAuth.mockReturnValue({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [bottle], pours: [pour], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
    })

    renderHome()

    expect(screen.getAllByText('Eagle Rare').length).toBeGreaterThan(0)
    expect(screen.getByText('Working Fire')).toBeInTheDocument()
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument()
  })

  it('shows a Coming Soon section when a bottle is incoming', () => {
    const incoming: Bottle = {
      id: 'b2',
      name: 'Elmer T. Lee',
      status: 'incoming',
      createdAt: 1,
    }

    mockUseAuth.mockReturnValue({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [incoming], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
    })

    renderHome()

    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    expect(screen.getAllByText('Elmer T. Lee').length).toBeGreaterThan(0)
  })
})
