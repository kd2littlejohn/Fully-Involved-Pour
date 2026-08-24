import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PhotoActionSheet } from './PhotoActionSheet'

describe('PhotoActionSheet', () => {
  it('offers Take Photo and Choose Photo but no Remove option when there is no existing photo', () => {
    render(<PhotoActionSheet title="Marcus" hasPhoto={false} onFile={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Take Photo')).toBeInTheDocument()
    expect(screen.getByText('Choose Photo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Photo' })).not.toBeInTheDocument()
  })

  it('offers a Remove Photo action once a photo already exists', () => {
    render(<PhotoActionSheet title="Marcus" hasPhoto onFile={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Take New Photo')).toBeInTheDocument()
    expect(screen.getByText('Choose New Photo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Photo' })).toBeInTheDocument()
  })

  it('calls onFile with the picked file and closes', async () => {
    const onFile = vi.fn()
    const onClose = vi.fn()
    render(<PhotoActionSheet title="Marcus" hasPhoto={false} onFile={onFile} onClose={onClose} />)

    const file = new File(['data'], 'marcus.jpg', { type: 'image/jpeg' })
    const [, chooseInput] = screen.getAllByLabelText(/photo/i, { selector: 'input' })
    await userEvent.upload(chooseInput!, file)

    expect(onFile).toHaveBeenCalledWith(file)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onRemove and closes when Remove Photo is tapped', async () => {
    const onRemove = vi.fn()
    const onClose = vi.fn()
    render(<PhotoActionSheet title="Marcus" hasPhoto onFile={vi.fn()} onRemove={onRemove} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove Photo' }))

    expect(onRemove).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
