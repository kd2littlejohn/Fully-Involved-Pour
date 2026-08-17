import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PourStoryCard } from './PourStoryCard'
import type { Bottle, Pour } from '../../data/types'

const mockUpdatePour = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ updatePour: mockUpdatePour, deletePour: vi.fn(), addPour: vi.fn() }),
}))

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }

const pour: Pour = {
  id: 'p1',
  bottleId: 'b1',
  date: '2026-06-01',
  rating: 8.6,
  memory: 'Great catch-up.',
  fip: { nose: 2.1, palate: 3, finish: 1.7, complexity: 0.8, value: 0.75, total: 8.6, noseAromas: [], palateFlavors: [] },
}

describe('PourStoryCard', () => {
  it('opens the read-only detail view for its own pour when clicked', async () => {
    render(<PourStoryCard pour={pour} bottle={bottle} />)

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Great catch-up/ }))

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows the pour photo when the pour has one', () => {
    const { container } = render(<PourStoryCard pour={{ ...pour, photoUrl: 'https://x/pour.jpg' }} bottle={bottle} />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/pour.jpg')
  })

  it('falls back to the bottle photo when the pour has none', () => {
    const { container } = render(<PourStoryCard pour={pour} bottle={{ ...bottle, imageUrl: 'https://x/bottle.jpg' }} />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/bottle.jpg')
  })

  it('shows a placeholder when neither pour nor bottle has a photo', () => {
    const { container } = render(<PourStoryCard pour={{ ...pour, photoUrl: undefined }} bottle={bottle} />)
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('shows the companion when the pour has one', () => {
    render(<PourStoryCard pour={{ ...pour, companion: 'Dad' }} bottle={bottle} />)
    expect(screen.getByText('With Dad')).toBeInTheDocument()
  })

  it('falls back to pour.notes for the short note when memory is unset (Quick Pour case)', () => {
    render(<PourStoryCard pour={{ ...pour, memory: undefined, notes: 'Great porch pour' }} bottle={bottle} />)
    expect(screen.getByText('Great porch pour')).toBeInTheDocument()
  })

  it('offers "Feature This Memory" in the card menu when not yet featured', async () => {
    render(<PourStoryCard pour={pour} bottle={bottle} />)
    await userEvent.click(screen.getByRole('button', { name: /pour actions/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Feature This Memory' }))
    expect(mockUpdatePour).toHaveBeenCalledWith('p1', expect.objectContaining({ isFeatured: true }))
  })

  it('offers "Remove From Featured" once a pour is already featured', async () => {
    render(<PourStoryCard pour={{ ...pour, isFeatured: true }} bottle={bottle} />)
    await userEvent.click(screen.getByRole('button', { name: /pour actions/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove From Featured' }))
    expect(mockUpdatePour).toHaveBeenCalledWith('p1', expect.objectContaining({ isFeatured: false }))
  })

  it('shows the feature-reason badge and moves the score below the story on a featured card', () => {
    render(<PourStoryCard pour={pour} bottle={bottle} variant="featured" reason="hall-of-fame" />)
    expect(screen.getByText('Hall of Fame')).toBeInTheDocument()
  })

  it('does not show a reason badge on a standard card', () => {
    render(<PourStoryCard pour={pour} bottle={bottle} />)
    expect(screen.queryByText('Hall of Fame')).not.toBeInTheDocument()
    expect(screen.queryByText('Bottle Kill')).not.toBeInTheDocument()
  })
})
