import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { CANVAS_HEIGHT, CANVAS_WIDTH, computeFitRect, findBoundingBox, standardizeBottlePhoto } from './standardizeBottlePhoto'

// Builds a flat RGBA buffer of the given size, fully transparent except for
// an opaque rectangle at [x, x+w) x [y, y+h).
function makeAlphaBuffer(width: number, height: number, opaqueRect?: { x: number; y: number; width: number; height: number }) {
  const data = new Uint8ClampedArray(width * height * 4)
  if (opaqueRect) {
    for (let y = opaqueRect.y; y < opaqueRect.y + opaqueRect.height; y++) {
      for (let x = opaqueRect.x; x < opaqueRect.x + opaqueRect.width; x++) {
        data[(y * width + x) * 4 + 3] = 255
      }
    }
  }
  return data
}

describe('findBoundingBox', () => {
  it('finds the exact bounding box of a tall, narrow bottle silhouette', () => {
    const data = makeAlphaBuffer(200, 400, { x: 80, y: 20, width: 40, height: 360 })
    expect(findBoundingBox(data, 200, 400)).toEqual({ x: 80, y: 20, width: 40, height: 360 })
  })

  it('finds the exact bounding box of a short, wide bottle silhouette', () => {
    const data = makeAlphaBuffer(400, 200, { x: 50, y: 60, width: 300, height: 80 })
    expect(findBoundingBox(data, 400, 200)).toEqual({ x: 50, y: 60, width: 300, height: 80 })
  })

  it('returns null for a fully transparent image (background removal wiped everything)', () => {
    const data = makeAlphaBuffer(100, 100)
    expect(findBoundingBox(data, 100, 100)).toBeNull()
  })

  it('returns null when only a tiny speck survives (noise, not a real bottle)', () => {
    const data = makeAlphaBuffer(1000, 1000, { x: 500, y: 500, width: 2, height: 2 })
    expect(findBoundingBox(data, 1000, 1000)).toBeNull()
  })

  it('ignores near-transparent anti-aliased edge pixels below the alpha threshold', () => {
    const data = makeAlphaBuffer(50, 50, { x: 10, y: 10, width: 20, height: 20 })
    // A faint edge halo just above zero alpha, outside the solid rect —
    // should not widen the box.
    data[(5 * 50 + 5) * 4 + 3] = 3
    expect(findBoundingBox(data, 50, 50)).toEqual({ x: 10, y: 10, width: 20, height: 20 })
  })
})

describe('computeFitRect', () => {
  it('centers a tall bottle within the margin, scaled up to the height limit', () => {
    const rect = computeFitRect({ width: 100, height: 500 }, CANVAS_WIDTH, CANVAS_HEIGHT)
    const maxDrawHeight = CANVAS_HEIGHT * 0.76
    expect(rect.drawHeight).toBeCloseTo(maxDrawHeight, 5)
    expect(rect.dx).toBeCloseTo((CANVAS_WIDTH - rect.drawWidth) / 2, 5)
    expect(rect.dy).toBeCloseTo((CANVAS_HEIGHT - rect.drawHeight) / 2, 5)
  })

  it('centers a short, wide bottle within the margin, scaled to the width limit', () => {
    const rect = computeFitRect({ width: 500, height: 120 }, CANVAS_WIDTH, CANVAS_HEIGHT)
    const maxDrawWidth = CANVAS_WIDTH * 0.76
    expect(rect.drawWidth).toBeCloseTo(maxDrawWidth, 5)
  })

  it('never crops: the drawn region always fits within the margin box for a square source', () => {
    const rect = computeFitRect({ width: 300, height: 300 }, CANVAS_WIDTH, CANVAS_HEIGHT)
    expect(rect.drawWidth).toBeLessThanOrEqual(CANVAS_WIDTH * 0.76 + 0.001)
    expect(rect.drawHeight).toBeLessThanOrEqual(CANVAS_HEIGHT * 0.76 + 0.001)
  })

  it('never crops for a landscape (wider than tall) source photo either', () => {
    const rect = computeFitRect({ width: 1600, height: 900 }, CANVAS_WIDTH, CANVAS_HEIGHT)
    expect(rect.drawWidth).toBeLessThanOrEqual(CANVAS_WIDTH * 0.76 + 0.001)
    expect(rect.drawHeight).toBeLessThanOrEqual(CANVAS_HEIGHT * 0.76 + 0.001)
  })

  it('preserves aspect ratio (no stretching)', () => {
    const rect = computeFitRect({ width: 200, height: 800 }, CANVAS_WIDTH, CANVAS_HEIGHT)
    expect(rect.drawWidth / rect.drawHeight).toBeCloseTo(200 / 800, 5)
  })
})

// ---------------------------------------------------------------------------
// Integration-level tests for the full pipeline. jsdom has no real <canvas>
// 2D rendering, so HTMLCanvasElement/Image are stubbed just enough to drive
// the real control flow (success / cutout-failure fallback / total failure)
// without asserting on actual pixels — that's covered by the pure-function
// tests above instead.

const mockRemoveBottleBackground = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  removeBottleBackground: (...args: unknown[]) => mockRemoveBottleBackground(...args),
}))

vi.mock('../ai/imageToBase64', () => ({
  downscaleImageToJpegBase64: () => Promise.resolve('downscaled-base64'),
}))

let getContextSpy: ReturnType<typeof vi.spyOn>
let toBlobSpy: ReturnType<typeof vi.spyOn>

function fakeCtx() {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    fillStyle: '',
    getImageData(this: void, _x: number, _y: number, width: number, height: number) {
      // Only the cutout-loading canvas ever calls getImageData in this
      // pipeline; whether it "has content" is driven by imageHasContent
      // below, keyed by the image src the test set up.
      return { data: currentImageData, width, height }
    },
  }
}

let currentImageData: Uint8ClampedArray

beforeEach(() => {
  mockRemoveBottleBackground.mockReset()
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return fakeCtx() as unknown as CanvasRenderingContext2D
  })
  toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(['fake-image-bytes'], { type: 'image/jpeg' }))
  })
  // Every Image load "succeeds" instantly with a plausible size, regardless
  // of src — the tests control behavior via currentImageData and the
  // removeBottleBackground mock instead of real decoding.
  vi.spyOn(window, 'Image').mockImplementation(function (this: HTMLImageElement) {
    Object.defineProperty(this, 'naturalWidth', { value: 300, configurable: true })
    Object.defineProperty(this, 'naturalHeight', { value: 600, configurable: true })
    Object.defineProperty(this, 'src', {
      set: () => queueMicrotask(() => this.onload?.(new Event('load'))),
      configurable: true,
    })
    return this
  } as unknown as typeof Image)
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
    queueMicrotask(() => {
      Object.defineProperty(this, 'result', { value: 'data:image/jpeg;base64,original', configurable: true })
      this.onload?.(new ProgressEvent('load') as never)
    })
  })
})

afterEach(() => {
  getContextSpy.mockRestore()
  toBlobSpy.mockRestore()
  vi.restoreAllMocks()
})

function file(name = 'photo.jpg') {
  return new File(['data'], name, { type: 'image/jpeg' })
}

describe('standardizeBottlePhoto', () => {
  it('returns status "ready" and a standardized display file when background removal finds a real bottle', async () => {
    mockRemoveBottleBackground.mockResolvedValue('cutout-base64')
    currentImageData = makeAlphaBuffer(300, 600, { x: 50, y: 50, width: 200, height: 500 })

    const original = file('IMG_1234.jpg')
    const result = await standardizeBottlePhoto(original)

    expect(result.status).toBe('ready')
    expect(result.originalFile).toBe(original)
    expect(result.displayFile.type).toBe('image/jpeg')
    expect(result.displayFile.name).toBe('IMG_1234-fip.jpg')
  })

  it('falls back to compositing the plain original (status "failed") when the cutout has no surviving content', async () => {
    mockRemoveBottleBackground.mockResolvedValue('cutout-base64')
    currentImageData = makeAlphaBuffer(300, 600) // fully transparent — nothing survived

    const result = await standardizeBottlePhoto(file())

    expect(result.status).toBe('failed')
    expect(result.displayFile.type).toBe('image/jpeg')
  })

  it('falls back to compositing the plain original (status "failed") when removeBottleBackground itself fails', async () => {
    mockRemoveBottleBackground.mockRejectedValue(new Error('Could not remove the background from that photo.'))

    const result = await standardizeBottlePhoto(file())

    expect(result.status).toBe('failed')
    expect(result.displayFile.type).toBe('image/jpeg')
  })

  it('never blocks bottle creation: returns the original file untouched if canvas support is unavailable entirely', async () => {
    mockRemoveBottleBackground.mockResolvedValue('cutout-base64')
    currentImageData = makeAlphaBuffer(300, 600, { x: 50, y: 50, width: 200, height: 500 })
    getContextSpy.mockReturnValue(null)

    const original = file()
    const result = await standardizeBottlePhoto(original)

    expect(result.status).toBe('failed')
    expect(result.displayFile).toBe(original)
    expect(result.originalFile).toBe(original)
  })
})
