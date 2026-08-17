import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BottlePhotoHero, type BottlePhotoChange } from './BottlePhotoHero'
import type { LabelScanResult } from '../../data/repositories/ai'

function ControlledHero({ onScanResult }: { onScanResult: (info: LabelScanResult) => void }) {
  const [photo, setPhoto] = useState<BottlePhotoChange>({ imageUrl: undefined })
  return <BottlePhotoHero imageUrl={photo.imageUrl} onImageChange={setPhoto} onScanResult={onScanResult} />
}

const mockStandardizeAndUpload = vi.fn()
const mockScan = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

vi.mock('../../features/photoUpload/standardizeAndUploadBottlePhoto', () => ({
  standardizeAndUploadBottlePhoto: (...args: unknown[]) => mockStandardizeAndUpload(...args),
}))

vi.mock('../../data/repositories/ai', () => ({
  scanBottleLabel: (...args: unknown[]) => mockScan(...args),
}))

vi.mock('../../features/ai/imageToBase64', () => ({
  downscaleImageToJpegBase64: () => Promise.resolve('base64data'),
}))

const uploadResult = {
  imageUrl: 'https://example.com/bottle-fip.jpg',
  originalImageUrl: 'https://example.com/bottle-original.jpg',
  imageProcessingStatus: 'ready' as const,
}

beforeEach(() => {
  mockStandardizeAndUpload.mockReset()
  mockScan.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:local-preview')
  URL.revokeObjectURL = vi.fn()
})

describe('BottlePhotoHero', () => {
  it('uploads a photo chosen via Choose Photo and reports the standardized result', async () => {
    mockStandardizeAndUpload.mockResolvedValue(uploadResult)
    const onImageChange = vi.fn()
    render(<BottlePhotoHero onImageChange={onImageChange} onScanResult={vi.fn()} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Choose Photo'), file)

    expect(onImageChange).toHaveBeenCalledWith({ imageUrl: 'blob:local-preview' })
    expect(mockStandardizeAndUpload).toHaveBeenCalledWith('u1', file, expect.any(Function))
    await vi.waitFor(() => expect(onImageChange).toHaveBeenLastCalledWith(uploadResult))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview')
    expect(mockScan).not.toHaveBeenCalled()
  })

  it('scans the label and uploads in parallel when Scan Label with AI is used', async () => {
    mockStandardizeAndUpload.mockResolvedValue(uploadResult)
    mockScan.mockResolvedValue({ found: true, name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace' })
    const onScanResult = vi.fn()
    render(<BottlePhotoHero onImageChange={vi.fn()} onScanResult={onScanResult} />)

    const file = new File(['data'], 'label.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Scan Label with AI', { exact: false }), file)

    await vi.waitFor(() =>
      expect(onScanResult).toHaveBeenCalledWith({ found: true, name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace' }),
    )
  })

  it('shows an inline error when the label cannot be read', async () => {
    mockStandardizeAndUpload.mockResolvedValue(uploadResult)
    mockScan.mockResolvedValue({ found: false })
    render(<BottlePhotoHero onImageChange={vi.fn()} onScanResult={vi.fn()} />)

    const file = new File(['data'], 'label.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Scan Label with AI', { exact: false }), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't read a bottle label in that photo — fill in the details manually below.",
    )
  })

  it('shows the upload error message when the upload fails', async () => {
    mockStandardizeAndUpload.mockRejectedValue(new Error('You do not have permission to upload this image.'))
    render(<BottlePhotoHero onImageChange={vi.fn()} onScanResult={vi.fn()} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Choose Photo'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to upload this image.')
  })

  it('offers Retry after a failed upload and re-attempts the same file without re-picking it', async () => {
    mockStandardizeAndUpload.mockRejectedValueOnce(new Error('The upload was interrupted. Tap Retry.'))
    mockStandardizeAndUpload.mockResolvedValueOnce(uploadResult)
    const onImageChange = vi.fn()
    render(<BottlePhotoHero onImageChange={onImageChange} onScanResult={vi.fn()} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Choose Photo'), file)
    await screen.findByRole('alert')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(mockStandardizeAndUpload).toHaveBeenCalledTimes(2)
    expect(mockStandardizeAndUpload).toHaveBeenNthCalledWith(2, 'u1', file, expect.any(Function))
    await vi.waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(onImageChange).toHaveBeenLastCalledWith(uploadResult)
  })

  it('does not show a Retry button when there is no error', () => {
    render(<BottlePhotoHero onImageChange={vi.fn()} onScanResult={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('lets you scan an already-chosen photo instead of picking it again', async () => {
    mockStandardizeAndUpload.mockResolvedValue(uploadResult)
    mockScan.mockResolvedValue({ found: true, name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace' })
    const onScanResult = vi.fn()
    render(<ControlledHero onScanResult={onScanResult} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Choose Photo'), file)

    const scanButton = await screen.findByRole('button', { name: /Scan This Photo for Details/ })
    expect(mockScan).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Scan Label with AI', { exact: false })).not.toBeInTheDocument()

    await userEvent.click(scanButton)

    expect(mockScan).toHaveBeenCalledWith('base64data', 'image/jpeg')
    expect(onScanResult).toHaveBeenCalledWith({ found: true, name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace' })
    expect(mockStandardizeAndUpload).toHaveBeenCalledTimes(1) // reuses the already-uploaded photo, no re-upload
  })

  it('shows the bottle initials in the placeholder when a name is given but no photo yet', () => {
    render(<BottlePhotoHero name="Eagle Rare 10 Year" onImageChange={vi.fn()} onScanResult={vi.fn()} />)

    expect(screen.getByText('ER')).toBeInTheDocument()
  })

  it('shows a Remove button once an image is set, and clears it on click', async () => {
    const onImageChange = vi.fn()
    render(<BottlePhotoHero imageUrl="https://example.com/bottle.jpg" onImageChange={onImageChange} onScanResult={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onImageChange).toHaveBeenCalledWith({ imageUrl: undefined })
  })
})
