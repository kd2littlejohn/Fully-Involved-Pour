import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RollTheDiceButton } from './RollTheDiceButton'
import type { Bottle } from '../../data/types'

let mockBottles: Bottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: mockBottles } }),
}))

beforeEach(() => {
  mockBottles = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RollTheDiceButton', () => {
  it('draws a bottle independently of which number is chosen, from pourable (open/sealed) bottles only', async () => {
    mockBottles = [
      { id: 'b1', name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', status: 'open', createdAt: 1 },
      { id: 'b2', name: 'Weller 12', status: 'sealed', createdAt: 2 },
      { id: 'b3', name: 'Pappy Van Winkle 15 Year', status: 'wishlist', createdAt: 3 },
    ]
    // Two pourable bottles (index 0 and 1); force the random draw to pick index 0
    // while the user clicks the button labeled "Choose 2" — proving the picked
    // bottle isn't derived from the chosen number.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<RollTheDiceButton />)

    await userEvent.click(screen.getByRole('button', { name: '🎲 Roll the Dice' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose 2' }))

    expect(screen.getByText('Eagle Rare 10 Year')).toBeInTheDocument()
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()
    expect(screen.queryByText('Pappy Van Winkle 15 Year')).not.toBeInTheDocument()
  })

  it('never draws a wishlist bottle', async () => {
    mockBottles = [{ id: 'b1', name: 'Eagle Rare 10 Year', status: 'open', createdAt: 1 }]
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    render(<RollTheDiceButton />)

    await userEvent.click(screen.getByRole('button', { name: '🎲 Roll the Dice' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose 6' }))

    expect(screen.getByText('Eagle Rare 10 Year')).toBeInTheDocument()
  })

  it('shows an empty state when there are no pourable bottles', async () => {
    mockBottles = [{ id: 'b1', name: 'Pappy Van Winkle 15 Year', status: 'wishlist', createdAt: 1 }]
    render(<RollTheDiceButton />)

    await userEvent.click(screen.getByRole('button', { name: '🎲 Roll the Dice' }))

    expect(screen.getByText('Nothing to roll yet.')).toBeInTheDocument()
  })
})
