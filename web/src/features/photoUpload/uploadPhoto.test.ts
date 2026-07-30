import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockIsMockAuthEnabled = vi.fn()

vi.mock('../../data/devMode', () => ({
  isMockAuthEnabled: () => mockIsMockAuthEnabled(),
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}))

vi.mock('../../data/firebase', () => ({
  storage: {},
}))

beforeEach(() => {
  mockIsMockAuthEnabled.mockReset()
  // jsdom doesn't implement createObjectURL — stub it for the mock-mode path.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
})

describe('uploadPhoto', () => {
  it('rejects files over the size limit before touching Storage or mock mode', async () => {
    const { uploadPhoto, PhotoTooLargeError } = await import('./uploadPhoto')
    const bigFile = new File([new Uint8Array(9 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
    await expect(uploadPhoto('u1', bigFile, 'bottle-photos')).rejects.toBeInstanceOf(PhotoTooLargeError)
  })

  it('returns a local object URL in mock mode instead of writing to real Storage', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { uploadPhoto } = await import('./uploadPhoto')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const url = await uploadPhoto('u1', file, 'bottle-photos')
    expect(url).toBe('blob:mock-url')
  })
})
