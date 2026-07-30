import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryForm } from './MemoryForm'
import type { Bottle, Memory } from '../../data/types'

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open' },
  { id: 'b2', name: 'Weller 12', status: 'sealed' },
]

describe('MemoryForm', () => {
  it('requires a title and a story before submitting', async () => {
    const onSubmit = vi.fn()
    render(<MemoryForm bottles={bottles} onCancel={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Save Memory' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Give this memory a title.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('parses comma-separated people into an array and submits the full payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<MemoryForm bottles={bottles} onCancel={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText('Title'), "Dad's retirement toast")
    await userEvent.type(screen.getByLabelText('People'), 'Dad, Mike')
    await userEvent.selectOptions(screen.getByLabelText('Bottle (optional)'), 'b1')
    await userEvent.type(screen.getByLabelText('The story'), 'Celebrated 30 years on the job.')
    await userEvent.click(screen.getByRole('button', { name: 'Save Memory' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Dad's retirement toast",
        people: ['Dad', 'Mike'],
        bottleId: 'b1',
        story: 'Celebrated 30 years on the job.',
      }),
    )
  })

  it('prefills from an existing memory when editing', () => {
    const memory: Memory = {
      id: 'm1',
      title: 'Anniversary',
      date: '2026-05-01',
      people: ['Sarah'],
      bottleId: 'b2',
      story: 'Shared a pour at home.',
    }

    render(<MemoryForm bottles={bottles} initial={memory} onCancel={vi.fn()} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Title')).toHaveValue('Anniversary')
    expect(screen.getByLabelText('People')).toHaveValue('Sarah')
    expect(screen.getByLabelText('Bottle (optional)')).toHaveValue('b2')
    expect(screen.getByLabelText('The story')).toHaveValue('Shared a pour at home.')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})
