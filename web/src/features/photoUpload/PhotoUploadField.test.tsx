import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoUploadField } from './PhotoUploadField'

const mockUpload = vi.fn()

vi.mock('./uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
}))

vi.mock('./cutoutBottlePhoto', () => ({
  cutoutBottlePhoto: (file: File) => Promise.resolve(file),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

beforeEach(() => {
  mockUpload.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:local-preview')
  URL.revokeObjectURL = vi.fn()
})

describe('PhotoUploadField', () => {
  it('shows an instant local preview, then swaps to the uploaded URL', async () => {
    mockUpload.mockResolvedValue('https://example.com/photo.jpg')
    const onUploaded = vi.fn()
    render(<PhotoUploadField label="Photo" folder="memory-photos" onUploaded={onUploaded} />)

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText('Photo')
    await userEvent.upload(input, file)

    expect(mockUpload).toHaveBeenCalledWith('u1', file, 'memory-photos', expect.any(Function))
    expect(onUploaded).toHaveBeenCalledWith('https://example.com/photo.jpg')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview')
  })

  it('shows the upload error message', async () => {
    mockUpload.mockRejectedValue(new Error('You do not have permission to upload this image.'))
    render(<PhotoUploadField label="Photo" folder="bottle-photos" onUploaded={vi.fn()} />)

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Photo'), file)

    expect(await screen.findByText('You do not have permission to upload this image.')).toBeInTheDocument()
  })
})
