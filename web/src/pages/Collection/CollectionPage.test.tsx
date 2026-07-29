import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CollectionPage } from './CollectionPage'
import type { Bottle } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockAddBottle = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

function renderCollection() {
  return render(
    <MemoryRouter>
      <CollectionPage />
    </MemoryRouter>,
  )
}

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 },
  { id: 'b2', name: 'Weller 12', status: 'sealed', createdAt: 2 },
  { id: 'b3', name: 'Pappy 15 (wishlist)', status: 'wishlist', createdAt: 3 },
  { id: 'b4', name: 'Favorite Pick', status: 'sealed', favorite: true, createdAt: 4 },
]

describe('CollectionPage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], infinityBottles: [], customLibrary: [] },
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
      userDoc: { bottles, pours: [], infinityBottles: [], customLibrary: [] },
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

  it('submits a new bottle through the Add Bottle modal', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockUseUserData.mockReturnValue({
      userDoc: { bottles: [], pours: [], infinityBottles: [], customLibrary: [] },
      loading: false,
      signedIn: true,
      addBottle: mockAddBottle,
    })

    renderCollection()

    await userEvent.click(screen.getByRole('button', { name: 'Add a Bottle' }))

    const dialog = screen.getByRole('dialog', { hidden: true })
    await userEvent.type(within(dialog).getByLabelText('Bottle name'), 'Blanton\'s')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Bottle' }))

    expect(mockAddBottle).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Blanton's", status: 'sealed' }),
    )
  })
})
