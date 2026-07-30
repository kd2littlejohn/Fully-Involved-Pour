import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RollTheDiceButton } from './RollTheDiceButton'
import type { Bottle } from '../../data/types'

let mockBottles: Bottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: mockBottles } }),
}))

beforeEach(() => {
  mockBottles = []
})

describe('RollTheDiceButton', () => {
  it('picks a bottle by the chosen number, from pourable (open/sealed) bottles only', async () => {
    mockBottles = [
      { id: 'b1', name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', status: 'open', createdAt: 1 },
      { id: 'b2', name: 'Weller 12', status: 'sealed', createdAt: 2 },
      { id: 'b3', name: 'Pappy Van Winkle 15 Year', status: 'wishlist', createdAt: 3 },
    ]
    render(<RollTheDiceButton />)

    await userEvent.click(screen.getByRole('button', { name: '🎲 Roll the Dice' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose 2' }))

    expect(screen.getByText('Weller 12')).toBeInTheDocument()
    expect(screen.queryByText('Pappy Van Winkle 15 Year')).not.toBeInTheDocument()
  })

  it('wraps the chosen number across a shorter pourable list', async () => {
    mockBottles = [{ id: 'b1', name: 'Eagle Rare 10 Year', status: 'open', createdAt: 1 }]
    render(<RollTheDiceButton />)

    await userEvent.click(screen.getByRole('button', { name: '🎲 Roll the Dice' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose 4' }))

    expect(screen.getByText('Eagle Rare 10 Year')).toBeInTheDocument()
  })

  it('shows an empty state when there are no pourable bottles', async () => {
    mockBottles = [{ id: 'b1', name: 'Pappy Van Winkle 15 Year', status: 'wishlist', createdAt: 1 }]
    render(<RollTheDiceButton />)

    await userEvent.click(screen.getByRole('button', { name: '🎲 Roll the Dice' }))

    expect(screen.getByText('Nothing to roll yet.')).toBeInTheDocument()
  })
})
