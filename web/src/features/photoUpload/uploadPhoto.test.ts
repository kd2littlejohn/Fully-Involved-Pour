import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockIsMockAuthEnabled = vi.fn()
const mockUploadBytesResumable = vi.fn()
const mockGetDownloadURL = vi.fn()

vi.mock('../../data/devMode', () => ({
  isMockAuthEnabled: () => mockIsMockAuthEnabled(),
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytesResumable: (...args: unknown[]) => mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}))

vi.mock('../../data/firebase', () => ({
  storage: {},
}))

// Real image decoding (FileReader/Image/canvas) isn't reliable against
// synthetic binary data in jsdom — covered separately by imageToBase64's
// own tests. Here it's a mockable pass-through by default so uploadPhoto's
// own logic (auth, validation, Storage call, error mapping, resize
// fallback) can be tested in isolation.
const mockResizeImageFile = vi.fn()

vi.mock('../ai/imageToBase64', () => ({
  resizeImageFile: (file: File) => mockResizeImageFile(file),
}))

beforeEach(() => {
  mockIsMockAuthEnabled.mockReset()
  mockUploadBytesResumable.mockReset()
  mockGetDownloadURL.mockReset()
  mockResizeImageFile.mockReset().mockImplementation((file: File) => Promise.resolve(file))
  // jsdom doesn't implement createObjectURL — stub it for the mock-mode path.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
})

describe('uploadPhoto', () => {
  it('requires an authenticated user', async () => {
    const { uploadPhoto, NotAuthenticatedError } = await import('./uploadPhoto')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(uploadPhoto(undefined, file, 'bottle-photos')).rejects.toBeInstanceOf(NotAuthenticatedError)
  })

  it('rejects unsupported file types', async () => {
    const { uploadPhoto, UnsupportedFileTypeError } = await import('./uploadPhoto')
    const file = new File(['data'], 'notes.txt', { type: 'text/plain' })
    await expect(uploadPhoto('u1', file, 'bottle-photos')).rejects.toBeInstanceOf(UnsupportedFileTypeError)
  })

  it('accepts a HEIC file even when the browser reports no MIME type', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { uploadPhoto } = await import('./uploadPhoto')
    const file = new File(['data'], 'photo.heic', { type: '' })
    await expect(uploadPhoto('u1', file, 'bottle-photos')).resolves.toBe('blob:mock-url')
  })

  it('rejects files over the 10MB limit', async () => {
    const { uploadPhoto, PhotoTooLargeError } = await import('./uploadPhoto')
    const bigFile = new File([new Uint8Array(11 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
    await expect(uploadPhoto('u1', bigFile, 'bottle-photos')).rejects.toBeInstanceOf(PhotoTooLargeError)
  })

  it('returns a local object URL in mock mode instead of writing to real Storage', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { uploadPhoto } = await import('./uploadPhoto')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const url = await uploadPhoto('u1', file, 'bottle-photos')
    expect(url).toBe('blob:mock-url')
  })

  it('uploads via uploadBytesResumable, reports progress, and resolves with the download URL', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockGetDownloadURL.mockResolvedValue('https://example.com/photo.jpg')
    let onChange: ((snap: { bytesTransferred: number; totalBytes: number }) => void) | undefined
    let onComplete: (() => void) | undefined
    mockUploadBytesResumable.mockReturnValue({
      snapshot: { ref: {} },
      on: (_event: string, changeCb: typeof onChange, _errorCb: unknown, completeCb: typeof onComplete) => {
        onChange = changeCb
        onComplete = completeCb
      },
    })

    const { uploadPhoto } = await import('./uploadPhoto')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const progressUpdates: number[] = []
    const promise = uploadPhoto('u1', file, 'bottle-photos', (p) => progressUpdates.push(p))

    // uploadPhoto awaits resizeImageFile (mocked as a resolved promise)
    // before it calls uploadBytesResumable and registers .on() — flush that
    // microtask before the handlers below exist for us to call.
    await Promise.resolve()
    await Promise.resolve()
    onChange?.({ bytesTransferred: 50, totalBytes: 100 })
    onComplete?.()

    await expect(promise).resolves.toBe('https://example.com/photo.jpg')
    expect(progressUpdates).toEqual([0.5])
  })

  it('falls back to the original file and still uploads when resizing fails (e.g. an undecodable HEIC variant)', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockResizeImageFile.mockRejectedValue(new Error('Could not read image'))
    mockGetDownloadURL.mockResolvedValue('https://example.com/photo.heic')
    let onComplete: (() => void) | undefined
    mockUploadBytesResumable.mockReturnValue({
      snapshot: { ref: {} },
      on: (_event: string, _changeCb: unknown, _errorCb: unknown, completeCb: typeof onComplete) => {
        onComplete = completeCb
      },
    })

    const { uploadPhoto } = await import('./uploadPhoto')
    const file = new File(['data'], 'photo.heic', { type: 'image/heic' })
    const promise = uploadPhoto('u1', file, 'bottle-photos')

    await Promise.resolve()
    await Promise.resolve()
    onComplete?.()

    await expect(promise).resolves.toBe('https://example.com/photo.heic')
    // The original (unresized) file is what actually got uploaded.
    expect(mockUploadBytesResumable).toHaveBeenCalledWith(expect.anything(), file, expect.objectContaining({ contentType: 'image/heic' }))
  })

  it('maps a storage/unauthorized failure to a clear message', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    let onError: ((err: unknown) => void) | undefined
    mockUploadBytesResumable.mockReturnValue({
      snapshot: { ref: {} },
      on: (_event: string, _changeCb: unknown, errorCb: typeof onError) => {
        onError = errorCb
      },
    })

    const { uploadPhoto } = await import('./uploadPhoto')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const promise = uploadPhoto('u1', file, 'bottle-photos')

    await Promise.resolve()
    await Promise.resolve()
    onError?.(Object.assign(new Error('nope'), { code: 'storage/unauthorized' }))

    await expect(promise).rejects.toThrow('You do not have permission to upload this image.')
  })
})
