import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PourStoryDetail } from './PourStoryDetail'
import type { Bottle, Pour } from '../../data/types'

const mockUpdatePour = vi.fn().mockResolvedValue(undefined)
const mockDeletePour = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ updatePour: mockUpdatePour, deletePour: mockDeletePour, addPour: vi.fn() }),
}))

beforeEach(() => {
  mockUpdatePour.mockClear()
  mockDeletePour.mockClear()
})

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }

const pour: Pour = {
  id: 'p1',
  bottleId: 'b1',
  date: '2026-06-01',
  rating: 8.6,
  companion: 'Dad',
  location: 'Back porch',
  memory: 'Great catch-up.',
  buyAgain: 'probably',
  fip: {
    nose: 2.1,
    palate: 3.0,
    finish: 1.7,
    complexity: 0.8,
    value: 0.75,
    total: 8.6,
    noseAromas: ['Vanilla'],
    palateFlavors: ['Oak'],
    noseNotes: 'Sweet and warm.',
  },
}

describe('PourStoryDetail', () => {
  it('shows the full read-only pour story', () => {
    render(<PourStoryDetail pour={pour} bottle={bottle} onClose={vi.fn()} />)

    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.getByText('Back porch')).toBeInTheDocument()
    expect(screen.getByText('Dad')).toBeInTheDocument()
    expect(screen.getByText('Great catch-up.')).toBeInTheDocument()
    expect(screen.getAllByText('Vanilla').length).toBeGreaterThan(0)
    expect(screen.getByText('Sweet and warm.')).toBeInTheDocument()
  })

  it('requires confirmation before deleting, then calls deletePour and closes', async () => {
    const onClose = vi.fn()
    render(<PourStoryDetail pour={pour} bottle={bottle} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockDeletePour).not.toHaveBeenCalled()
    expect(screen.getByText('Delete this Pour Story?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))
    expect(mockDeletePour).toHaveBeenCalledWith('p1')
    expect(onClose).toHaveBeenCalled()
  })

  it('opens the wizard prefilled when Edit is clicked, and saves via updatePour', async () => {
    const onClose = vi.fn()
    render(<PourStoryDetail pour={pour} bottle={bottle} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Edit Pour Story — Eagle Rare')).toBeInTheDocument()
    expect(screen.getByLabelText('With')).toHaveValue('Dad')

    await userEvent.click(screen.getByRole('button', { name: 'Next' })) // -> Nose
    expect(screen.getByLabelText('Nose')).toHaveValue('2.1')

    // Advance through the remaining steps to Summary and save unchanged.
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdatePour).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        date: '2026-06-01',
        companion: 'Dad',
        fip: expect.objectContaining({ nose: 2.1, total: 8.4 }),
      }),
    )
    expect(onClose).toHaveBeenCalled()
  })
})
