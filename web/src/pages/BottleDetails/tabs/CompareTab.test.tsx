import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompareTab } from './CompareTab'
import type { Bottle } from '../../../data/types'

const mockCastVote = vi.fn().mockResolvedValue(undefined)
const mockGetTally = vi.fn()

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Kevin' }, loading: false }),
}))

vi.mock('../../../features/faceoff/repository', () => ({
  castFaceoffVote: (...args: unknown[]) => mockCastVote(...args),
  getFaceoffTally: (...args: unknown[]) => mockGetTally(...args),
}))

const eagleRare: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }
const blantons: Bottle = { id: 'b2', name: "Blanton's Original", status: 'open', createdAt: 2 }

beforeEach(() => {
  mockCastVote.mockClear()
  mockGetTally.mockReset()
})

describe('CompareTab faceoff tally', () => {
  it('shows a "no votes yet" message when nobody has voted', async () => {
    mockGetTally.mockResolvedValue({ votesForA: 0, votesForB: 0 })
    render(<CompareTab bottle={eagleRare} otherBottles={[blantons]} pours={[]} />)

    await userEvent.selectOptions(screen.getByLabelText('Compare with'), 'b2')

    expect(await screen.findByText('No votes yet — be the first.')).toBeInTheDocument()
  })

  it('shows the vote split once tallies exist', async () => {
    mockGetTally.mockResolvedValue({ votesForA: 3, votesForB: 1 })
    render(<CompareTab bottle={eagleRare} otherBottles={[blantons]} pours={[]} />)

    await userEvent.selectOptions(screen.getByLabelText('Compare with'), 'b2')

    expect(await screen.findByText('Eagle Rare — 75% (3)')).toBeInTheDocument()
    expect(screen.getByText("Blanton's Original — 25% (1)")).toBeInTheDocument()
  })

  it('refetches the tally after casting a vote', async () => {
    mockGetTally.mockResolvedValueOnce({ votesForA: 0, votesForB: 0 }).mockResolvedValueOnce({ votesForA: 1, votesForB: 0 })
    render(<CompareTab bottle={eagleRare} otherBottles={[blantons]} pours={[]} />)

    await userEvent.selectOptions(screen.getByLabelText('Compare with'), 'b2')
    await screen.findByText('No votes yet — be the first.')

    await userEvent.click(screen.getByRole('button', { name: 'Eagle Rare' }))

    expect(mockCastVote).toHaveBeenCalledWith('u1', 'Kevin', 'Eagle Rare', "Blanton's Original", 'Eagle Rare')
    expect(await screen.findByText('Eagle Rare — 100% (1)')).toBeInTheDocument()
  })
})
