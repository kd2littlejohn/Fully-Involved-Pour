import { render, screen } from '@testing-library/react'
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

function renderCollection() {
  return render(
    <MemoryRouter>
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
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: false,
      addBottle: mockAddBottle,
    })

    renderCollection()

    expect(screen.getByText('Your whiskey journey starts here.')).toBeInTheDocument()
  })

  it('filters the grid by status when a chip is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
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
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
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
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.type(screen.getByLabelText('Search your collection'), 'eagle')

    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()
  })

  it('searches by distillery', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.type(screen.getByLabelText('Search your collection'), 'buffalo trace')

    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.getByText('Weller 12')).toBeInTheDocument()
    expect(screen.queryByText(/Pappy 15/)).not.toBeInTheDocument()
  })

  it('combines search with the active status filter and updates chip counts', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.type(screen.getByLabelText('Search your collection'), 'buffalo trace')
    await userEvent.click(screen.getByRole('button', { name: /Sealed \(1\)/ }))

    expect(screen.getByText('Weller 12')).toBeInTheDocument()
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument() // open, not sealed
    expect(screen.queryByText('Favorite Pick')).not.toBeInTheDocument() // sealed, but no distillery match
  })

  it('shows a "no matches" empty state for a search with no results', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })
    renderCollection()

    await userEvent.type(screen.getByLabelText('Search your collection'), 'nonexistent bottle')

    expect(screen.getByText('No bottles match "nonexistent bottle".')).toBeInTheDocument()
  })

  it('navigates to the Add Bottle page when Add a Bottle is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
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
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
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
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
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

  it('selects individual bottles by clicking their card', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
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
