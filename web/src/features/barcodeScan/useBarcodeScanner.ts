import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'

export type ScannerStatus = 'requesting' | 'scanning' | 'detected' | 'permission-denied' | 'no-camera' | 'error'

const BARCODE_FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8']
// Roughly 5 detection attempts/sec — fast enough to feel instant, cheap
// enough not to visibly heat up or drain a phone during a longer scan.
const NATIVE_POLL_INTERVAL_MS = 200

interface UseBarcodeScannerResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: ScannerStatus
  errorMessage: string | undefined
  restart: () => void
}

// Prefers the native BarcodeDetector API (fast, on-device, no extra
// download) where it exists, but that's Chromium-only today — mobile
// Safari has never shipped it — so this always has the ZXing fallback
// ready, dynamically imported only when actually needed so Safari/Firefox
// users are the only ones who pay for that bundle weight.
export function useBarcodeScanner(active: boolean, onDetected: (upc: string) => void): UseBarcodeScannerResult {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<ScannerStatus>('requesting')
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
  const [restartKey, setRestartKey] = useState(0)

  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let stream: MediaStream | undefined
    let intervalId: ReturnType<typeof setInterval> | undefined
    let zxingControls: IScannerControls | undefined

    async function start() {
      setStatus('requesting')
      setErrorMessage(undefined)

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          setStatus('permission-denied')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setStatus('no-camera')
        } else {
          setStatus('error')
          setErrorMessage('Could not access the camera. Please try again.')
        }
        return
      }

      const video = videoRef.current
      if (cancelled || !video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // Some browsers reject play() if the element unmounts mid-await —
        // the cancelled check right after covers that; anything else just
        // means the video starts once autoplay/user-gesture rules allow it.
      }
      if (cancelled) return
      setStatus('scanning')

      function handleDetected(rawValue: string) {
        if (cancelled) return
        const value = rawValue.trim()
        if (!value) return
        setStatus('detected')
        onDetectedRef.current(value)
      }

      if ('BarcodeDetector' in window) {
        const DetectorCtor = (window as unknown as { BarcodeDetector: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
        const detector = new DetectorCtor({ formats: BARCODE_FORMATS })
        intervalId = setInterval(() => {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return
          detector
            .detect(videoRef.current)
            .then((barcodes) => {
              const value = barcodes[0]?.rawValue
              if (value && !cancelled) {
                if (intervalId) clearInterval(intervalId)
                handleDetected(value)
              }
            })
            .catch(() => {
              // A single frame failing to decode isn't an error worth
              // surfacing — the next tick just tries again.
            })
        }, NATIVE_POLL_INTERVAL_MS)
        return
      }

      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        if (cancelled) return
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
        ])
        const reader = new BrowserMultiFormatReader(hints)
        zxingControls = await reader.decodeFromVideoElement(video, (result) => {
          if (result && !cancelled) {
            zxingControls?.stop()
            handleDetected(result.getText())
          }
        })
      } catch {
        if (!cancelled) {
          setStatus('error')
          setErrorMessage('Could not start the barcode scanner on this device.')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      zxingControls?.stop()
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [active, restartKey])

  return {
    videoRef,
    status,
    errorMessage,
    restart: () => setRestartKey((k) => k + 1),
  }
}
