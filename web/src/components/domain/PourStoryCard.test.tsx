import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PourStoryCard } from './PourStoryCard'
import type { Bottle, Pour } from '../../data/types'

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ updatePour: vi.fn(), deletePour: vi.fn(), addPour: vi.fn() }),
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

    await userEvent.click(screen.getByRole('button', { name: /Eagle Rare/ }))

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
})
