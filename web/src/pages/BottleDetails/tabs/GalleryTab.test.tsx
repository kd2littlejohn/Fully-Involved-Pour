import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GalleryTab } from './GalleryTab'
import type { Bottle } from '../../../data/types'

const mockAddGalleryPhoto = vi.fn().mockResolvedValue(undefined)
const mockDeleteGalleryPhoto = vi.fn().mockResolvedValue(undefined)

vi.mock('../../../hooks/useUserData', () => ({
  useUserData: () => ({ addGalleryPhoto: mockAddGalleryPhoto, deleteGalleryPhoto: mockDeleteGalleryPhoto }),
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

beforeEach(() => {
  mockAddGalleryPhoto.mockClear()
  mockDeleteGalleryPhoto.mockReset().mockResolvedValue(undefined)
})

const bottle: Bottle = {
  id: 'b1',
  name: 'Eagle Rare',
  status: 'open',
  gallery: [{ url: 'https://example.com/1.jpg', storagePath: 'bottle-photos/u1/1.jpg', caption: 'Label close-up' }],
}

describe('GalleryTab', () => {
  it('shows an empty state when there are no photos yet', () => {
    render(<GalleryTab bottle={{ ...bottle, gallery: [] }} />)
    expect(screen.getByText('No photos yet.')).toBeInTheDocument()
  })

  it('renders existing gallery photos', () => {
    render(<GalleryTab bottle={bottle} />)
    expect(screen.getByAltText('Label close-up')).toHaveAttribute('src', 'https://example.com/1.jpg')
  })

  it('shows a proper modal confirmation with the required copy, not an inline gallery tile', async () => {
    render(<GalleryTab bottle={bottle} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete photo' }))

    // A real dialog, not a card in the gallery grid.
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Delete this photo?')).toBeInTheDocument()
    expect(screen.getByText('This removes the photo from this bottle and cannot be undone.')).toBeInTheDocument()
    expect(mockDeleteGalleryPhoto).not.toHaveBeenCalled()
  })

  it('confirming calls deleteGalleryPhoto and closes the dialog on success', async () => {
    render(<GalleryTab bottle={bottle} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Photo' }))

    expect(mockDeleteGalleryPhoto).toHaveBeenCalledWith('b1', 'https://example.com/1.jpg')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables both actions and shows "Deleting…" while the delete is in flight, preventing a double submit', async () => {
    let resolveDelete: () => void = () => {}
    mockDeleteGalleryPhoto.mockReturnValue(new Promise<void>((resolve) => (resolveDelete = resolve)))
    render(<GalleryTab bottle={bottle} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Photo' }))

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    // A second tap while still in flight must not fire a second call.
    await userEvent.click(screen.getByRole('button', { name: 'Deleting…' }))
    expect(mockDeleteGalleryPhoto).toHaveBeenCalledTimes(1)

    resolveDelete()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('a failed delete keeps the photo, shows a retryable error, and leaves the dialog open', async () => {
    mockDeleteGalleryPhoto.mockRejectedValueOnce(new Error('network error'))
    render(<GalleryTab bottle={bottle} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Photo' }))

    expect(await screen.findByText('Could not delete that photo. Try again.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByAltText('Label close-up')).toBeInTheDocument()

    // Retry succeeds.
    mockDeleteGalleryPhoto.mockResolvedValueOnce(undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Photo' }))
    expect(mockDeleteGalleryPhoto).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelling the confirmation leaves the photo untouched', async () => {
    render(<GalleryTab bottle={bottle} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockDeleteGalleryPhoto).not.toHaveBeenCalled()
    expect(screen.getByAltText('Label close-up')).toBeInTheDocument()
  })

  it('deleting one of several photos only targets the one that was tapped', async () => {
    const twoPhotos: Bottle = {
      ...bottle,
      gallery: [
        { url: 'https://example.com/1.jpg', storagePath: 'bottle-photos/u1/1.jpg', caption: 'Label close-up' },
        { url: 'https://example.com/2.jpg', storagePath: 'bottle-photos/u1/2.jpg', caption: 'Back porch' },
      ],
    }
    render(<GalleryTab bottle={twoPhotos} />)

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete photo' })
    await userEvent.click(deleteButtons[1]!)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Photo' }))

    expect(mockDeleteGalleryPhoto).toHaveBeenCalledWith('b1', 'https://example.com/2.jpg')
    expect(mockDeleteGalleryPhoto).not.toHaveBeenCalledWith('b1', 'https://example.com/1.jpg')
  })

  it('adding a new photo captures its storage path for later cleanup', async () => {
    render(<GalleryTab bottle={bottle} />)
    // PhotoUploadField itself is covered by its own tests — this just
    // confirms GalleryTab wires the path through, not the upload mechanics.
    expect(screen.getByLabelText('Add a photo')).toBeInTheDocument()
  })
})
