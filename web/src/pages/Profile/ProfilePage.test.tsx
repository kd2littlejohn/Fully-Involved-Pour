import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'
import type { Bottle, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockUseBlindProfileStats = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../features/profile/useBlindProfileStats', () => ({
  useBlindProfileStats: () => mockUseBlindProfileStats(),
}))

function renderProfile() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  )
}

function emptyUserDoc() {
  return { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] }
}

describe('ProfilePage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({ userDoc: emptyUserDoc(), profile: undefined, loading: false, signedIn: false })
    mockUseBlindProfileStats.mockReturnValue({ stats: undefined, loading: false })
    renderProfile()
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('keeps the Friends and Settings icons visible while bottles/pours are still loading, not just after', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false })
    mockUseUserData.mockReturnValue({ userDoc: emptyUserDoc(), profile: undefined, loading: true, signedIn: true })
    mockUseBlindProfileStats.mockReturnValue({ stats: undefined, loading: true })
    renderProfile()

    expect(screen.getByRole('link', { name: 'Friends' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it('shows empty-state sections and a developing Whiskey Identity when signed in with nothing yet', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false })
    mockUseUserData.mockReturnValue({ userDoc: emptyUserDoc(), profile: undefined, loading: false, signedIn: true })
    mockUseBlindProfileStats.mockReturnValue({ stats: undefined, loading: false })
    renderProfile()

    expect(screen.getByText('Kevin')).toBeInTheDocument()
    expect(screen.getByText(/still forming/)).toBeInTheDocument()
    expect(screen.getByText('Your favorites will build up here.')).toBeInTheDocument()
    expect(screen.getByText('Your Blind Profile starts here.')).toBeInTheDocument()
    expect(screen.getByText('Milestones will show up here.')).toBeInTheDocument()
  })

  it('shows real profile header details, collection stats, and favorites — no fabricated data', () => {
    const bottles: Bottle[] = [
      {
        id: 'b1',
        name: 'Eagle Rare',
        distillery: 'Buffalo Trace',
        status: 'open',
        proof: 90,
        flavors: ['Caramel'],
        createdAt: 1,
        favorite: true,
      },
      { id: 'b2', name: "Blanton's", distillery: 'Buffalo Trace', status: 'open', createdAt: 2 },
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
        username: 'kevin_pours',
      },
      profile: { username: 'kevin_pours', bio: 'Bourbon first.', location: 'Nashville, TN' },
      loading: false,
      signedIn: true,
    })
    mockUseBlindProfileStats.mockReturnValue({ stats: undefined, loading: false })

    renderProfile()

    expect(screen.getByText('@kevin_pours')).toBeInTheDocument()
    expect(screen.getByText('Nashville, TN')).toBeInTheDocument()
    expect(screen.getByText('Bourbon first.')).toBeInTheDocument()

    expect(screen.getByText('Favorite Bottle')).toBeInTheDocument()
    expect(screen.getAllByText('Eagle Rare').length).toBeGreaterThan(0)
    expect(screen.getByText('Favorite Distillery')).toBeInTheDocument()
    expect(screen.getAllByText('Buffalo Trace').length).toBeGreaterThan(0)
    expect(screen.getByText('Favorite Companion')).toBeInTheDocument()
    expect(screen.getByText('Dad')).toBeInTheDocument()
    expect(screen.getByText('Most Shared Bottle')).toBeInTheDocument()

    // No Legacy Shelf or inline Settings/Sign Out at the bottom of Profile.
    expect(screen.queryByText('Legacy Shelf')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })
})
