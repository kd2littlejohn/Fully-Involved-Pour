import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BottlePhotoLightbox } from './BottlePhotoLightbox'
import type { Bottle } from '../../data/types'

const mockUpload = vi.fn()
const mockUpdateBottle = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ updateBottle: mockUpdateBottle }),
}))

vi.mock('../../features/photoUpload/uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
}))

vi.mock('../../features/photoUpload/cutoutBottlePhoto', () => ({
  cutoutBottlePhoto: (file: File) => Promise.resolve(file),
}))

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }

beforeEach(() => {
  mockUpload.mockReset()
  mockUpdateBottle.mockReset()
})

describe('BottlePhotoLightbox', () => {
  it('replaces the bottle photo and saves the new URL', async () => {
    mockUpload.mockResolvedValue('https://example.com/new-photo.jpg')
    render(<BottlePhotoLightbox bottle={bottle} onClose={vi.fn()} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Add Photo'), file)

    expect(mockUpload).toHaveBeenCalledWith('u1', file, 'bottle-photos')
    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { imageUrl: 'https://example.com/new-photo.jpg' })
  })

  it('shows an error message when the upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('You do not have permission to upload this image.'))
    render(<BottlePhotoLightbox bottle={bottle} onClose={vi.fn()} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Add Photo'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to upload this image.')
    expect(mockUpdateBottle).not.toHaveBeenCalled()
  })

  it('calls onClose when the modal is dismissed', async () => {
    const onClose = vi.fn()
    render(<BottlePhotoLightbox bottle={bottle} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })
})
