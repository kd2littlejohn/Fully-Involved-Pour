import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'
import type { Bottle, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

function renderProfile() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  )
}

describe('ProfilePage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: false,
    })
    renderProfile()
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('shows zeroed stats and empty-state sections when signed in with nothing yet', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
    })
    renderProfile()
    expect(screen.getByText('Your favorites will build up here.')).toBeInTheDocument()
    expect(screen.getByText('No Legacy Shelf bottles yet.')).toBeInTheDocument()
  })

  it('shows real collection stats, favorites, and Legacy Shelf bottles', () => {
    const bottles: Bottle[] = [
      { id: 'b1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open', proof: 90, flavors: ['Caramel'], createdAt: 1 },
      {
        id: 'b2',
        name: "Blanton's",
        distillery: 'Buffalo Trace',
        status: 'open',
        legacyShelf: true,
        legacyShelfReason: 'First bourbon I loved',
        createdAt: 2,
      },
    ]
    const pours: Pour[] = [
      {
        id: 'p1',
        bottleId: 'b1',
        date: '2026-01-01',
        rating: 9,
        companion: 'Dad',
        fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: 9, noseAromas: [], palateFlavors: [] },
      },
    ]

    mockUseAuth.mockReturnValue({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: {
        bottles,
        pours,
        memories: [{ id: 'm1', title: 'A memory', date: '2026-01-01', people: [], story: 'A story.' }],
        infinityBottles: [],
        customLibrary: [],
      },
      loading: false,
      signedIn: true,
    })
    renderProfile()

    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2) // total bottles + opened bottles (both 2 here)
    expect(screen.getByText('Favorite Distillery')).toBeInTheDocument()
    expect(screen.getAllByText('Buffalo Trace').length).toBeGreaterThan(0)
    expect(screen.getByText('Favorite Companion')).toBeInTheDocument()
    expect(screen.getByText('Dad')).toBeInTheDocument()
    expect(screen.getByText('Most Shared Bottle')).toBeInTheDocument()
    expect(screen.getByText("Blanton's")).toBeInTheDocument()
    expect(screen.getByText('First bourbon I loved')).toBeInTheDocument()
  })
})
