import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StartPourStoryButton } from './StartPourStoryButton'
import type { Bottle } from '../../data/types'

const mockUseUserData = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open' },
  { id: 'b2', name: 'Pappy 15', status: 'wishlist' },
  { id: 'b3', name: 'Weller 12', status: 'sealed' },
]

describe('StartPourStoryButton', () => {
  it('opens the wizard directly when a bottleId is already known', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] } })
    render(<StartPourStoryButton bottleId="b1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour Story' }))

    expect(screen.getByText('Add a Pour Story — Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Which bottle?')).not.toBeInTheDocument()
  })

  it('shows a picker excluding wishlist bottles when no bottleId is given', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] } })
    render(<StartPourStoryButton />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour Story' }))

    expect(screen.getByText('Which bottle?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Eagle Rare/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Weller 12/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pappy 15/ })).not.toBeInTheDocument()
  })

  it('opens the wizard for the picked bottle', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] } })
    render(<StartPourStoryButton />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour Story' }))
    await userEvent.click(screen.getByRole('button', { name: /Weller 12/ }))

    expect(screen.getByText('Add a Pour Story — Weller 12')).toBeInTheDocument()
  })
})
