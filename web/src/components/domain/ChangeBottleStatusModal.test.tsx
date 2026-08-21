import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChangeBottleStatusModal } from './ChangeBottleStatusModal'
import type { Bottle } from '../../data/types'

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'sealed' }

describe('ChangeBottleStatusModal', () => {
  it('lists every status, disables the current one, and tags it "Current"', () => {
    render(<ChangeBottleStatusModal bottle={bottle} onUpdate={vi.fn()} onClose={vi.fn()} />)

    for (const label of ['Wish List', 'Incoming', 'Sealed', 'Opened', 'Finished']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
    const current = screen.getByText('Current').closest('button')
    expect(current).toHaveTextContent('Sealed')
    expect(current).toBeDisabled()
  })

  it('changes status with a single tap and closes — no edit form involved', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<ChangeBottleStatusModal bottle={bottle} onUpdate={onUpdate} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Incoming' }))

    expect(onUpdate).toHaveBeenCalledWith('b1', { status: 'incoming' })
    expect(onClose).toHaveBeenCalled()
  })

  it('defaults openedDate to today when moving to Opened, but never overwrites a date already on the bottle', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<ChangeBottleStatusModal bottle={bottle} onUpdate={onUpdate} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Opened' }))
    expect(onUpdate).toHaveBeenCalledWith('b1', { status: 'open', openedDate: expect.any(String) })

    onUpdate.mockClear()
    render(<ChangeBottleStatusModal bottle={{ ...bottle, openedDate: '2026-01-01' }} onUpdate={onUpdate} onClose={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Opened' })[1]!)
    expect(onUpdate).toHaveBeenCalledWith('b1', { status: 'open', openedDate: '2026-01-01' })
  })

  it('defaults finishedDate to today when moving to Finished, but never overwrites a date already on the bottle', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<ChangeBottleStatusModal bottle={{ ...bottle, finishedDate: '2026-02-02' }} onUpdate={onUpdate} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Finished' }))
    expect(onUpdate).toHaveBeenCalledWith('b1', { status: 'finished', finishedDate: '2026-02-02' })
  })

  it('never sets a date for statuses that do not track one (Wish List, Sealed)', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<ChangeBottleStatusModal bottle={{ ...bottle, status: 'wishlist' }} onUpdate={onUpdate} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sealed' }))
    expect(onUpdate).toHaveBeenCalledWith('b1', { status: 'sealed' })
  })

  it('calls onStatusChanged with the new status after a successful update', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onStatusChanged = vi.fn()
    render(<ChangeBottleStatusModal bottle={bottle} onUpdate={onUpdate} onClose={vi.fn()} onStatusChanged={onStatusChanged} />)

    await userEvent.click(screen.getByRole('button', { name: 'Finished' }))
    expect(onStatusChanged).toHaveBeenCalledWith('finished')
  })

  it('does nothing when the current status is tapped again', async () => {
    const onUpdate = vi.fn()
    render(<ChangeBottleStatusModal bottle={bottle} onUpdate={onUpdate} onClose={vi.fn()} />)

    const current = screen.getByText('Current').closest('button')!
    await userEvent.click(current)
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
