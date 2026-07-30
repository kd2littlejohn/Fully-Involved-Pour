import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoUploadField } from './PhotoUploadField'

const mockUpload = vi.fn()

vi.mock('./uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
  PhotoTooLargeError: class PhotoTooLargeError extends Error {},
}))

vi.mock('./cutoutBottlePhoto', () => ({
  cutoutBottlePhoto: (file: File) => Promise.resolve(file),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

beforeEach(() => {
  mockUpload.mockReset()
})

describe('PhotoUploadField', () => {
  it('uploads the selected file and calls onUploaded with the resulting URL', async () => {
    mockUpload.mockResolvedValue('https://example.com/photo.jpg')
    const onUploaded = vi.fn()
    render(<PhotoUploadField label="Photo" folder="memory-photos" onUploaded={onUploaded} />)

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText('Photo')
    await userEvent.upload(input, file)

    expect(mockUpload).toHaveBeenCalledWith('u1', file, 'memory-photos')
    expect(onUploaded).toHaveBeenCalledWith('https://example.com/photo.jpg')
  })

  it('shows an error message when the upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('network down'))
    render(<PhotoUploadField label="Photo" folder="bottle-photos" onUploaded={vi.fn()} />)

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Photo'), file)

    expect(await screen.findByText('Photo upload failed. Please try again.')).toBeInTheDocument()
  })
})
