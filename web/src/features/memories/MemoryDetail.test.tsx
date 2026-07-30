import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryDetail } from './MemoryDetail'
import type { Bottle, Memory } from '../../data/types'

const mockUpdateMemory = vi.fn().mockResolvedValue(undefined)
const mockDeleteMemory = vi.fn().mockResolvedValue(undefined)
const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open' }]

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] }, updateMemory: mockUpdateMemory, deleteMemory: mockDeleteMemory }),
}))

beforeEach(() => {
  mockUpdateMemory.mockClear()
  mockDeleteMemory.mockClear()
})

const memory: Memory = {
  id: 'm1',
  title: "Dad's retirement toast",
  date: '2026-06-01',
  location: 'Back porch',
  people: ['Dad', 'Mike'],
  bottleId: 'b1',
  story: 'Celebrated 30 years on the job.',
}

describe('MemoryDetail', () => {
  it('shows the full read-only memory', () => {
    render(<MemoryDetail memory={memory} bottleName="Eagle Rare" onClose={vi.fn()} />)

    expect(screen.getByText("Dad's retirement toast")).toBeInTheDocument()
    expect(screen.getByText('Celebrated 30 years on the job.')).toBeInTheDocument()
    expect(screen.getByText('With Dad, Mike')).toBeInTheDocument()
  })

  it('requires confirmation before deleting, then calls deleteMemory and closes', async () => {
    const onClose = vi.fn()
    render(<MemoryDetail memory={memory} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockDeleteMemory).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))
    expect(mockDeleteMemory).toHaveBeenCalledWith('m1')
    expect(onClose).toHaveBeenCalled()
  })

  it('opens the form prefilled when Edit is clicked, and saves via updateMemory', async () => {
    const onClose = vi.fn()
    render(<MemoryDetail memory={memory} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Title')).toHaveValue("Dad's retirement toast")

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdateMemory).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ title: "Dad's retirement toast", people: ['Dad', 'Mike'] }),
    )
    expect(onClose).toHaveBeenCalled()
  })
})
