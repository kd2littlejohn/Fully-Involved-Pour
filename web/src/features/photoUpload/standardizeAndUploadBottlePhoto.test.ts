import { describe, expect, it, vi, beforeEach } from 'vitest'
import { standardizeAndUploadBottlePhoto } from './standardizeAndUploadBottlePhoto'

const mockStandardize = vi.fn()
const mockUpload = vi.fn()

vi.mock('./standardizeBottlePhoto', () => ({
  standardizeBottlePhoto: (...args: unknown[]) => mockStandardize(...args),
}))

vi.mock('./uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUpload(...args),
}))

beforeEach(() => {
  mockStandardize.mockReset()
  mockUpload.mockReset()
})

describe('standardizeAndUploadBottlePhoto', () => {
  it('uploads both the standardized display file and the preserved original, with distinct names', async () => {
    const original = new File(['orig'], 'IMG_1234.jpg', { type: 'image/jpeg' })
    const display = new File(['display'], 'IMG_1234-fip.jpg', { type: 'image/jpeg' })
    mockStandardize.mockResolvedValue({ displayFile: display, originalFile: original, status: 'ready' })
    mockUpload.mockResolvedValueOnce('https://example.com/display.jpg').mockResolvedValueOnce('https://example.com/original.jpg')

    const onProgress = vi.fn()
    const result = await standardizeAndUploadBottlePhoto('u1', original, onProgress)

    expect(mockStandardize).toHaveBeenCalledWith(original)
    expect(mockUpload).toHaveBeenCalledWith('u1', display, 'bottle-photos', onProgress)
    expect(mockUpload).toHaveBeenCalledWith('u1', original, 'bottle-photos')
    expect(result).toEqual({
      imageUrl: 'https://example.com/display.jpg',
      originalImageUrl: 'https://example.com/original.jpg',
      imageProcessingStatus: 'ready',
    })
  })

  it('carries a "failed" status through when standardization fell back to the plain original', async () => {
    const original = new File(['orig'], 'photo.jpg', { type: 'image/jpeg' })
    mockStandardize.mockResolvedValue({ displayFile: original, originalFile: original, status: 'failed' })
    mockUpload.mockResolvedValue('https://example.com/photo.jpg')

    const result = await standardizeAndUploadBottlePhoto('u1', original)

    expect(result.imageProcessingStatus).toBe('failed')
  })
})
