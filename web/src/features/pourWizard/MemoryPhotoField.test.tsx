import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryPhotoField } from './MemoryPhotoField'

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:pending-preview')
  URL.revokeObjectURL = vi.fn()
})

describe('MemoryPhotoField', () => {
  it('shows an empty "Add Memory Photo" state when there is no photo', () => {
    render(<MemoryPhotoField removed={false} onPick={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Add Memory Photo' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows a large preview for an existing photo', () => {
    const { container } = render(<MemoryPhotoField existingUrl="https://example.com/memory.jpg" removed={false} onPick={vi.fn()} onRemove={vi.fn()} />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/memory.jpg')
  })

  it('previews a locally picked file instead of the existing one', () => {
    const file = new File(['data'], 'moment.jpg', { type: 'image/jpeg' })
    const { container } = render(
      <MemoryPhotoField existingUrl="https://example.com/old.jpg" pendingFile={file} removed={false} onPick={vi.fn()} onRemove={vi.fn()} />,
    )
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:pending-preview')
  })

  it('hides the existing photo once removed, without a pending file', () => {
    render(<MemoryPhotoField existingUrl="https://example.com/old.jpg" removed onPick={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Add Memory Photo' })).toBeInTheDocument()
  })

  it('tapping the preview opens the action sheet and picking a file calls onPick', async () => {
    const onPick = vi.fn()
    render(<MemoryPhotoField existingUrl="https://example.com/old.jpg" removed={false} onPick={onPick} onRemove={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Change memory photo' }))
    expect(screen.getByText('Take New Photo')).toBeInTheDocument()

    const file = new File(['data'], 'new.jpg', { type: 'image/jpeg' })
    const [, chooseInput] = screen.getAllByLabelText(/photo/i, { selector: 'input' })
    await userEvent.upload(chooseInput!, file)

    expect(onPick).toHaveBeenCalledWith(file)
  })

  it('tapping "Add Memory Photo" opens the sheet without a Remove option', async () => {
    render(<MemoryPhotoField removed={false} onPick={vi.fn()} onRemove={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add Memory Photo' }))
    expect(screen.getByText('Take Photo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Photo' })).not.toBeInTheDocument()
  })

  it('removing from the sheet calls onRemove', async () => {
    const onRemove = vi.fn()
    render(<MemoryPhotoField existingUrl="https://example.com/old.jpg" removed={false} onPick={vi.fn()} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: 'Change memory photo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Photo' }))
    expect(onRemove).toHaveBeenCalled()
  })
})
