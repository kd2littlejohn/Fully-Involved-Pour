import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickAddFromPhotoButton } from './QuickAddFromPhotoButton'

const mockScan = vi.fn()
const mockAddBottle = vi.fn().mockResolvedValue(undefined)
const mockUploadPhoto = vi.fn()

vi.mock('../ai/imageToBase64', () => ({
  downscaleImageToJpegBase64: () => Promise.resolve('base64data'),
}))

vi.mock('../../data/repositories/ai', () => ({
  scanBottleLabel: (...args: unknown[]) => mockScan(...args),
}))

vi.mock('../photoUpload/uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
}))

vi.mock('../photoUpload/cutoutBottlePhoto', () => ({
  cutoutBottlePhoto: (file: File) => Promise.resolve(file),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ addBottle: mockAddBottle }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

beforeEach(() => {
  mockScan.mockReset()
  mockAddBottle.mockClear()
  mockUploadPhoto.mockReset().mockResolvedValue('https://example.com/photo.jpg')
})

describe('QuickAddFromPhotoButton', () => {
  it('scans an uploaded photo and opens the Add Bottle form prefilled', async () => {
    mockScan.mockResolvedValue({
      found: true,
      name: 'Eagle Rare 10 Year',
      distillery: 'Buffalo Trace',
      type: 'Bourbon',
      proof: 90,
    })
    render(<QuickAddFromPhotoButton />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(await screen.findByDisplayValue('Eagle Rare 10 Year')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Buffalo Trace')).toBeInTheDocument()
    expect(screen.getByDisplayValue('90')).toBeInTheDocument()

    // The scanned photo becomes the bottle's photo too, not just AI input.
    expect(mockUploadPhoto).toHaveBeenCalledWith('u1', expect.any(File), 'bottle-photos')
    const preview = document.querySelector('img[src="https://example.com/photo.jpg"]')
    expect(preview).toBeInTheDocument()
  })

  it('still opens the form for manual entry when the scan finds nothing, but keeps the photo', async () => {
    mockScan.mockResolvedValue({ found: false })
    render(<QuickAddFromPhotoButton />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(
      await screen.findByText("Couldn't read a bottle label in that photo — fill in the details manually below."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Bottle name')).toHaveValue('')
    expect(document.querySelector('img[src="https://example.com/photo.jpg"]')).toBeInTheDocument()
  })

  it('still prefills details if only the photo upload fails', async () => {
    mockScan.mockResolvedValue({ found: true, name: 'Eagle Rare 10 Year' })
    mockUploadPhoto.mockRejectedValue(new Error('storage down'))
    render(<QuickAddFromPhotoButton />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(await screen.findByDisplayValue('Eagle Rare 10 Year')).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })
})
