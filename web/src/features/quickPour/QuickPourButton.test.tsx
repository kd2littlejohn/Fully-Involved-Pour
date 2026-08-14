import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuickPourButton } from './QuickPourButton'
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

describe('QuickPourButton', () => {
  it('opens Quick Pour directly when a bottleId is already known', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] } })
    render(<QuickPourButton bottleId="b1" />)

    await userEvent.click(screen.getByRole('button', { name: '⚡ Quick Pour' }))

    expect(screen.getByText('Quick Pour — Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Which bottle?')).not.toBeInTheDocument()
  })

  it('shows a bottle picker excluding wishlist bottles when no bottleId is given', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] } })
    render(<QuickPourButton />)

    await userEvent.click(screen.getByRole('button', { name: '⚡ Quick Pour' }))

    expect(screen.getByText('Which bottle?')).toBeInTheDocument()
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toContain('Eagle Rare')
    expect(options).not.toContain('Pappy 15')
  })

  it('opens Quick Pour for the picked bottle', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] } })
    render(<QuickPourButton />)

    await userEvent.click(screen.getByRole('button', { name: '⚡ Quick Pour' }))
    await userEvent.selectOptions(screen.getByLabelText('Bottle'), 'b3')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Quick Pour — Weller 12')).toBeInTheDocument()
  })
})
