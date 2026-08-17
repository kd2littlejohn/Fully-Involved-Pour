import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BottlePhotoLightbox } from './BottlePhotoLightbox'
import type { Bottle } from '../../data/types'

const mockStandardizeAndUpload = vi.fn()
const mockUpdateBottle = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ updateBottle: mockUpdateBottle }),
}))

vi.mock('../../features/photoUpload/standardizeAndUploadBottlePhoto', () => ({
  standardizeAndUploadBottlePhoto: (...args: unknown[]) => mockStandardizeAndUpload(...args),
}))

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1 }

beforeEach(() => {
  mockStandardizeAndUpload.mockReset()
  mockUpdateBottle.mockReset()
})

describe('BottlePhotoLightbox', () => {
  it('replaces the bottle photo and saves the standardized + original URLs', async () => {
    mockStandardizeAndUpload.mockResolvedValue({
      imageUrl: 'https://example.com/new-photo-fip.jpg',
      originalImageUrl: 'https://example.com/new-photo-original.jpg',
      imageProcessingStatus: 'ready',
    })
    render(<BottlePhotoLightbox bottle={bottle} onClose={vi.fn()} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Add Photo'), file)

    expect(mockStandardizeAndUpload).toHaveBeenCalledWith('u1', file)
    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', {
      imageUrl: 'https://example.com/new-photo-fip.jpg',
      originalImageUrl: 'https://example.com/new-photo-original.jpg',
      imageProcessingStatus: 'ready',
    })
  })

  it('shows an error message when the upload fails', async () => {
    mockStandardizeAndUpload.mockRejectedValue(new Error('You do not have permission to upload this image.'))
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

  it('does not offer a View Original toggle when there is no original to show', () => {
    render(<BottlePhotoLightbox bottle={{ ...bottle, imageUrl: 'https://example.com/photo.jpg' }} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /View Original Photo/ })).not.toBeInTheDocument()
  })

  it('toggles between the standardized and original photo when both exist', async () => {
    const withOriginal: Bottle = {
      ...bottle,
      imageUrl: 'https://example.com/standardized.jpg',
      originalImageUrl: 'https://example.com/original.jpg',
    }
    const { container } = render(<BottlePhotoLightbox bottle={withOriginal} onClose={vi.fn()} />)

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/standardized.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'View Original Photo' }))
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/original.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'View Standardized Photo' }))
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/standardized.jpg')
  })
})
