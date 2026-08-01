import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BottlePhotoHero } from './BottlePhotoHero'
import type { LabelScanResult } from '../../data/repositories/ai'

function ControlledHero({ onScanResult }: { onScanResult: (info: LabelScanResult) => void }) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)
  return <BottlePhotoHero imageUrl={imageUrl} onImageChange={setImageUrl} onScanResult={onScanResult} />
}

const mockUpload = vi.fn()
const mockScan = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

vi.mock('../../features/photoUpload/uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
}))

vi.mock('../../features/photoUpload/cutoutBottlePhoto', () => ({
  cutoutBottlePhoto: (file: File) => Promise.resolve(file),
}))

vi.mock('../../data/repositories/ai', () => ({
  scanBottleLabel: (...args: unknown[]) => mockScan(...args),
}))

vi.mock('../../features/ai/imageToBase64', () => ({
  downscaleImageToJpegBase64: () => Promise.resolve('base64data'),
}))

beforeEach(() => {
  mockUpload.mockReset()
  mockScan.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:local-preview')
  URL.revokeObjectURL = vi.fn()
})

describe('BottlePhotoHero', () => {
  it('uploads a photo chosen via Choose Photo and reports the resulting URL', async () => {
    mockUpload.mockResolvedValue('https://example.com/bottle.jpg')
    const onImageChange = vi.fn()
    render(<BottlePhotoHero onImageChange={onImageChange} onScanResult={vi.fn()} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Choose Photo'), file)

    expect(onImageChange).toHaveBeenCalledWith('blob:local-preview')
    expect(mockUpload).toHaveBeenCalledWith('u1', file, 'bottle-photos', expect.any(Function))
    await vi.waitFor(() => expect(onImageChange).toHaveBeenLastCalledWith('https://example.com/bottle.jpg'))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview')
    expect(mockScan).not.toHaveBeenCalled()
  })

  it('scans the label and uploads in parallel when Scan Label with AI is used', async () => {
    mockUpload.mockResolvedValue('https://example.com/bottle.jpg')
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
    mockUpload.mockResolvedValue('https://example.com/bottle.jpg')
    mockScan.mockResolvedValue({ found: false })
    render(<BottlePhotoHero onImageChange={vi.fn()} onScanResult={vi.fn()} />)

    const file = new File(['data'], 'label.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Scan Label with AI', { exact: false }), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't read a bottle label in that photo — fill in the details manually below.",
    )
  })

  it('shows the upload error message when the upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('You do not have permission to upload this image.'))
    render(<BottlePhotoHero onImageChange={vi.fn()} onScanResult={vi.fn()} />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Choose Photo'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to upload this image.')
  })

  it('lets you scan an already-chosen photo instead of picking it again', async () => {
    mockUpload.mockResolvedValue('https://example.com/bottle.jpg')
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
    expect(mockUpload).toHaveBeenCalledTimes(1) // reuses the already-uploaded photo, no re-upload
  })

  it('shows the bottle initials in the placeholder when a name is given but no photo yet', () => {
    render(<BottlePhotoHero name="Eagle Rare 10 Year" onImageChange={vi.fn()} onScanResult={vi.fn()} />)

    expect(screen.getByText('ER')).toBeInTheDocument()
  })

  it('shows a Remove button once an image is set, and clears it on click', async () => {
    const onImageChange = vi.fn()
    render(<BottlePhotoHero imageUrl="https://example.com/bottle.jpg" onImageChange={onImageChange} onScanResult={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onImageChange).toHaveBeenCalledWith(undefined)
  })
})
