import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBarcodeScanner } from './useBarcodeScanner'

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(impl) },
  })
}

function fakeStream(): MediaStream {
  const track = { stop: vi.fn(), kind: 'video' } as unknown as MediaStreamTrack
  return { getTracks: () => [track] } as unknown as MediaStream
}

// jsdom has no native BarcodeDetector and no real <canvas> pipeline for the
// ZXing fallback to decode frames with, so most of these tests stub in a
// fake BarcodeDetector — deterministic, and exercises the exact same
// detect()-polling code path the real native API would.
function installFakeBarcodeDetector(detect: () => Promise<{ rawValue: string }[]>) {
  // A vi.fn() wrapping an arrow function can't be invoked with `new` (arrow
  // functions are never constructible) — the hook does `new BarcodeDetector(...)`,
  // so this needs a real function expression underneath.
  const detectorCtor = vi.fn().mockImplementation(function FakeBarcodeDetector() {
    return { detect }
  })
  Object.defineProperty(window, 'BarcodeDetector', { configurable: true, value: detectorCtor })
  return detectorCtor
}

// useBarcodeScanner needs its videoRef actually attached to a mounted
// <video> element to progress past "requesting" — a bare renderHook() never
// mounts anything, so this small harness renders the hook's status into the
// DOM the same way BarcodeScannerModal does.
function Harness({ active, onDetected }: { active: boolean; onDetected: (upc: string) => void }) {
  const { videoRef, status, errorMessage } = useBarcodeScanner(active, onDetected)
  return (
    <div>
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- test harness, no real media */}
      <video ref={videoRef} />
      <span data-testid="status">{status}</span>
      <span data-testid="error">{errorMessage}</span>
    </div>
  )
}

describe('useBarcodeScanner', () => {
  beforeEach(() => {
    // jsdom has no real camera pipeline — play() just needs to not blow up
    // the hook's own try/catch around it.
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, value: 4 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'BarcodeDetector')
  })

  it('reports permission-denied when getUserMedia rejects with NotAllowedError', async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
    render(<Harness active onDetected={vi.fn()} />)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('permission-denied'))
  })

  it('reports no-camera when getUserMedia rejects with NotFoundError', async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException('none', 'NotFoundError')))
    render(<Harness active onDetected={vi.fn()} />)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('no-camera'))
  })

  it('reports a generic error for any other getUserMedia failure', async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException('boom', 'AbortError')))
    render(<Harness active onDetected={vi.fn()} />)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error').textContent).toBeTruthy()
  })

  it('reaches scanning once the camera stream is granted, using the native BarcodeDetector when available', async () => {
    mockGetUserMedia(() => Promise.resolve(fakeStream()))
    const detectorCtor = installFakeBarcodeDetector(() => Promise.resolve([]))
    render(<Harness active onDetected={vi.fn()} />)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('scanning'))
    await waitFor(() => expect(detectorCtor).toHaveBeenCalledWith({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8'] }))
  })

  it('calls onDetected with the trimmed value once a frame decodes, and stops polling', async () => {
    mockGetUserMedia(() => Promise.resolve(fakeStream()))
    const detect = vi.fn().mockResolvedValue([{ rawValue: ' 012345678905 ' }])
    installFakeBarcodeDetector(detect)
    const onDetected = vi.fn()
    render(<Harness active onDetected={onDetected} />)

    await waitFor(() => expect(onDetected).toHaveBeenCalledWith('012345678905'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('detected'))
    const callsAtDetection = detect.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 250))
    // No further polling once a barcode has locked in — multiple scans of
    // the same still-visible barcode must never fire onDetected again.
    expect(detect.mock.calls.length).toBe(callsAtDetection)
    expect(onDetected).toHaveBeenCalledTimes(1)
  })

  it('does not request the camera at all while inactive', () => {
    const getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    render(<Harness active={false} onDetected={vi.fn()} />)

    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('stops every camera track on unmount', async () => {
    const stream = fakeStream()
    mockGetUserMedia(() => Promise.resolve(stream))
    installFakeBarcodeDetector(() => Promise.resolve([]))
    const { unmount } = render(<Harness active onDetected={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('scanning'))

    unmount()

    for (const track of stream.getTracks()) {
      expect(track.stop).toHaveBeenCalled()
    }
  })
})
