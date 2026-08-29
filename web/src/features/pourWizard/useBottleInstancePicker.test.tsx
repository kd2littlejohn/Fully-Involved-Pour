import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useBottleInstancePicker } from './useBottleInstancePicker'
import type { Bottle } from '../../data/types'

function TestHarness({ bottle, onResolved }: { bottle: Bottle | undefined; onResolved: (id: string | undefined) => void }) {
  const { resolveThenSave, picker } = useBottleInstancePicker(bottle)
  return (
    <div>
      <button type="button" onClick={() => resolveThenSave(onResolved)}>
        save
      </button>
      {picker}
    </div>
  )
}

describe('useBottleInstancePicker', () => {
  it('resolves immediately with no instance id for a plain bottle', async () => {
    const onResolved = vi.fn()
    render(<TestHarness bottle={{ id: 'b1', name: 'Eagle Rare', status: 'open' }} onResolved={onResolved} />)

    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(onResolved).toHaveBeenCalledWith(undefined)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('resolves immediately with the single open instance, no picker shown', async () => {
    const onResolved = vi.fn()
    const bottle: Bottle = {
      id: 'b1',
      name: 'Eagle Rare',
      status: 'open',
      instances: [
        { id: 'i1', status: 'open', createdAt: 1 },
        { id: 'i2', status: 'sealed', createdAt: 2 },
      ],
    }
    render(<TestHarness bottle={bottle} onResolved={onResolved} />)

    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(onResolved).toHaveBeenCalledWith('i1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks which bottle when more than one is open, and resolves with the picked instance', async () => {
    const onResolved = vi.fn()
    const bottle: Bottle = {
      id: 'b1',
      name: 'Eagle Rare',
      status: 'open',
      instances: [
        { id: 'i1', status: 'open', createdAt: 1 },
        { id: 'i2', status: 'open', createdAt: 2, label: 'Total Wine' },
      ],
    }
    render(<TestHarness bottle={bottle} onResolved={onResolved} />)

    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(onResolved).not.toHaveBeenCalled()
    expect(screen.getByText('Which bottle are you pouring from?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bottle #1' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bottle #2 — Total Wine' }))
    expect(onResolved).toHaveBeenCalledWith('i2')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
