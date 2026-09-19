import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FillLevelModal } from './FillLevelModal'
import type { Bottle } from '../../data/types'

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', fillLevel: 'half' }

describe('FillLevelModal', () => {
  it('marks the current fill level and disables it', () => {
    render(<FillLevelModal bottle={bottle} onUpdate={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Half/ })).toBeDisabled()
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('updates the fill level and closes when a new level is picked', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<FillLevelModal bottle={bottle} onUpdate={onUpdate} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Quarter' }))

    expect(onUpdate).toHaveBeenCalledWith('b1', { fillLevel: 'quarter' })
    expect(onClose).toHaveBeenCalled()
  })
})
