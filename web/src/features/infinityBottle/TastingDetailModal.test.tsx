import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TastingDetailModal } from './TastingDetailModal'
import type { InfinityTasting } from '../../data/types'

const mockUpdateTasting = vi.fn().mockResolvedValue(undefined)
const mockDeleteTasting = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    updateTasting: mockUpdateTasting,
    deleteTasting: mockDeleteTasting,
  }),
}))

vi.mock('./TastingForm', async () => {
  const actual = await vi.importActual<typeof import('./TastingForm')>('./TastingForm')
  return {
    ...actual,
    TastingForm: ({ onSubmit, submitLabel, submitting }: { onSubmit: () => void; submitLabel: string; submitting: boolean }) => (
      <button type="button" onClick={onSubmit} disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    ),
  }
})

function tasting(overrides: Partial<InfinityTasting> = {}): InfinityTasting {
  return {
    id: 't1',
    date: '2026-01-15',
    score: 8.5,
    noseAromas: ['Vanilla'],
    palateFlavors: ['Caramel'],
    overallNotes: 'Great balance.',
    createdAt: 1,
    ...overrides,
  }
}

const onClose = vi.fn()

beforeEach(() => {
  mockUpdateTasting.mockClear()
  mockDeleteTasting.mockClear()
  onClose.mockClear()
})

describe('TastingDetailModal', () => {
  it('renders the tasting details in view mode', () => {
    render(<TastingDetailModal infinityBottleId="ib1" batchId="b1" tasting={tasting()} onClose={onClose} />)
    expect(screen.getByText('8.5')).toBeInTheDocument()
    expect(screen.getByText('Vanilla')).toBeInTheDocument()
    expect(screen.getByText('Caramel')).toBeInTheDocument()
    expect(screen.getByText('Great balance.')).toBeInTheDocument()
  })

  it('Edit switches to the form and Save Changes calls updateTasting', async () => {
    render(<TastingDetailModal infinityBottleId="ib1" batchId="b1" tasting={tasting()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdateTasting).toHaveBeenCalledWith('ib1', 'b1', 't1', expect.any(Object))
    expect(onClose).toHaveBeenCalled()
  })

  it('Delete requires confirmation, then calls deleteTasting', async () => {
    render(<TastingDetailModal infinityBottleId="ib1" batchId="b1" tasting={tasting()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this tasting? This cannot be undone.')).toBeInTheDocument()
    expect(mockDeleteTasting).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Tasting' }))
    expect(mockDeleteTasting).toHaveBeenCalledWith('ib1', 'b1', 't1')
    expect(onClose).toHaveBeenCalled()
  })

  it('Cancel on the delete confirmation backs out without deleting', async () => {
    render(<TastingDetailModal infinityBottleId="ib1" batchId="b1" tasting={tasting()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockDeleteTasting).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows a retryable error if the delete fails', async () => {
    mockDeleteTasting.mockRejectedValueOnce(new Error('nope'))
    render(<TastingDetailModal infinityBottleId="ib1" batchId="b1" tasting={tasting()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Tasting' }))

    expect(await screen.findByText('Could not delete that tasting. Try again.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
