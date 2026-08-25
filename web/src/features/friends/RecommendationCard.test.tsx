import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RecommendationCard } from './RecommendationCard'
import type { Recommendation } from '../../data/types'

const mockAddBottle = vi.fn().mockResolvedValue('new-bottle-id')
const mockSetRecommendationStatus = vi.fn().mockResolvedValue(undefined)
const mockDeleteRecommendation = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ addBottle: mockAddBottle }),
}))

vi.mock('../../data/repositories/recommendations', () => ({
  setRecommendationStatus: (...args: unknown[]) => mockSetRecommendationStatus(...args),
  deleteRecommendation: (...args: unknown[]) => mockDeleteRecommendation(...args),
}))

beforeEach(() => {
  mockAddBottle.mockClear()
  mockSetRecommendationStatus.mockClear()
  mockDeleteRecommendation.mockClear()
})

const recommendation: Recommendation = {
  id: 'r1',
  senderId: 'friend-1',
  senderUsername: 'dad',
  senderDisplayName: 'Dad',
  recipientId: 'u1',
  bottleName: 'Weller 12',
  bottleDistillery: 'Buffalo Trace',
  status: 'pending',
  createdAt: 1,
}

describe('RecommendationCard', () => {
  it('offers Add to Wish List and Dismiss for a pending recommendation', () => {
    render(<RecommendationCard recommendation={recommendation} />)
    expect(screen.getByRole('button', { name: 'Add to Wish List' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('requires confirmation before deleting, then deletes and notifies onChange', async () => {
    const onChange = vi.fn()
    render(<RecommendationCard recommendation={recommendation} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Recommendation actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(screen.getByText('Delete this recommendation? This cannot be undone.')).toBeInTheDocument()
    expect(mockDeleteRecommendation).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mockDeleteRecommendation).toHaveBeenCalledWith('r1')
    expect(onChange).toHaveBeenCalled()
  })

  it('cancelling the delete confirmation leaves the recommendation untouched', async () => {
    render(<RecommendationCard recommendation={recommendation} />)

    await userEvent.click(screen.getByRole('button', { name: 'Recommendation actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Delete this recommendation? This cannot be undone.')).not.toBeInTheDocument()
    expect(mockDeleteRecommendation).not.toHaveBeenCalled()
  })
})
