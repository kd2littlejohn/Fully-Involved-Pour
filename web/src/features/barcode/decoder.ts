// On-device barcode decoding for Scan Barcode. Nothing here touches the
// network: a code is decoded, check-digit validated and normalized locally
// before anything is looked up.
//
// Two engines, same contract:
//  - 'native': the browser's BarcodeDetector (Chrome on Android; not Safari).
//  - 'zxing':  @zxing/browser, a free Apache-2.0 port that runs everywhere
//              getUserMedia does, including iPhone Safari. Lazy-loaded so
//              its code only downloads when someone actually scans.
// 'auto' prefers native when it supports the retail formats, else ZXing.

import { normalizeBarcode, type NormalizedBarcode } from './gtin'

export type DecodeEngine = 'native' | 'zxing'
export type EnginePreference = DecodeEngine | 'auto'

export interface DecodedBarcode {
  raw: string
  format: string
  engine: DecodeEngine
  normalized: Exclude<NormalizedBarcode, { error: string }>
  /** From the moment the camera was ready (live) or the file was picked (photo). */
  msToDecode: number
}

export interface LiveScanStats {
  engine: DecodeEngine
  /** getUserMedia call → first video frame. */
  msToCamera: number
  /** Raw reads that failed check-digit/format validation (likely misreads). */
  rejectedReads: number
}

export interface LiveScanner {
  stop(): void
  stats: LiveScanStats
}

const NATIVE_FORMATS = ['upc_a', 'upc_e', 'ean_13']

// Minimal typing for the Barcode Detection API (not in TS's DOM lib yet).
interface DetectedBarcode {
  rawValue: string
  format: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource | ImageBitmap): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (options: { formats: string[] }): BarcodeDetectorLike
  getSupportedFormats(): Promise<string[]>
}

function nativeCtor(): BarcodeDetectorCtor | undefined {
  return (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
}

export async function hasNativeDetector(): Promise<boolean> {
  const Ctor = nativeCtor()
  if (!Ctor) return false
  try {
    const supported = await Ctor.getSupportedFormats()
    return NATIVE_FORMATS.every((f) => supported.includes(f))
  } catch {
    return false
  }
}

async function resolveEngine(preference: EnginePreference): Promise<DecodeEngine> {
  if (preference !== 'auto') return preference
  return (await hasNativeDetector()) ? 'native' : 'zxing'
}

async function createZxingReader() {
  const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }, { applyUpcEFix }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
    import('./zxingUpcEFix'),
  ])
  applyUpcEFix()
  const hints = new Map<number, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13]],
    [DecodeHintType.TRY_HARDER, true],
  ])
  return { reader: new BrowserMultiFormatOneDReader(hints, { delayBetweenScanAttempts: 80 }), BarcodeFormat }
}

// Exposed for tests: accepts a read only once the same valid code has been
// seen `confirmations` times in a row, so a single noisy frame that happens
// to pass the check digit can't win. UPC-E needs one more: the Phase 0
// benchmark showed glare over half an EAN-13 can leave its other half
// readable as a different, check-digit-valid UPC-E.
export function createReadConfirmer(confirmations: number) {
  let last: string | null = null
  let streak = 0
  let rejected = 0
  return {
    offer(raw: string): Exclude<NormalizedBarcode, { error: string }> | null {
      const normalized = normalizeBarcode(raw)
      if (normalized.error !== undefined) {
        rejected += 1
        last = null
        streak = 0
        return null
      }
      streak = normalized.gtin13 === last ? streak + 1 : 1
      last = normalized.gtin13
      return streak >= confirmations + (normalized.symbology === 'UPC_E' ? 1 : 0) ? normalized : null
    },
    get rejected() {
      return rejected
    },
  }
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
}

export async function startLiveScan(
  video: HTMLVideoElement,
  onDecoded: (decoded: DecodedBarcode) => void,
  { engine: preference = 'auto', confirmations = 2 }: { engine?: EnginePreference; confirmations?: number } = {},
): Promise<LiveScanner> {
  const engine = await resolveEngine(preference)
  const confirmer = createReadConfirmer(confirmations)
  const cameraStart = performance.now()
  const stats: LiveScanStats = { engine, msToCamera: 0, rejectedReads: 0 }
  let readyAt = 0
  let done = false

  const accept = (raw: string, format: string, stop: () => void) => {
    if (done) return
    const normalized = confirmer.offer(raw)
    stats.rejectedReads = confirmer.rejected
    if (!normalized) return
    done = true
    stop()
    onDecoded({ raw, format, engine, normalized, msToDecode: Math.round(performance.now() - readyAt) })
  }

  if (engine === 'zxing') {
    const { reader, BarcodeFormat } = await createZxingReader()
    video.addEventListener(
      'playing',
      () => {
        readyAt = performance.now()
        stats.msToCamera = Math.round(readyAt - cameraStart)
      },
      { once: true },
    )
    const controls = await reader.decodeFromConstraints(CAMERA_CONSTRAINTS, video, (result, _error, ctl) => {
      if (result) accept(result.getText(), BarcodeFormat[result.getBarcodeFormat()], () => ctl.stop())
    })
    return {
      stats,
      stop: () => {
        done = true
        controls.stop()
      },
    }
  }

  const Ctor = nativeCtor()
  if (!Ctor) throw new Error('This browser has no built-in barcode detector.')
  const detector = new Ctor({ formats: NATIVE_FORMATS })
  const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  video.muted = true
  await video.play()
  readyAt = performance.now()
  stats.msToCamera = Math.round(readyAt - cameraStart)

  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    done = true
    if (timer) clearTimeout(timer)
    stream.getTracks().forEach((track) => track.stop())
    video.srcObject = null
  }
  const tick = async () => {
    if (done) return
    try {
      if (video.readyState >= 2) {
        for (const found of await detector.detect(video)) accept(found.rawValue, found.format.toUpperCase(), stop)
      }
    } catch {
      // A frame that fails to decode is normal; keep scanning.
    }
    if (!done) timer = setTimeout(tick, 80)
  }
  void tick()
  return { stats, stop }
}

// Still-photo fallback (and the "barcode photo" test): decode one image.
// Returns null when no valid UPC/EAN is found — never a guess.
export async function decodeImageFile(file: Blob, preference: EnginePreference = 'auto'): Promise<DecodedBarcode | null> {
  const engine = await resolveEngine(preference)
  const started = performance.now()
  const finish = (raw: string, format: string): DecodedBarcode | null => {
    const normalized = normalizeBarcode(raw)
    if (normalized.error !== undefined) return null
    return { raw, format, engine, normalized, msToDecode: Math.round(performance.now() - started) }
  }

  if (engine === 'native') {
    const Ctor = nativeCtor()
    if (!Ctor) return null
    const bitmap = await createImageBitmap(file)
    try {
      const found = await new Ctor({ formats: NATIVE_FORMATS }).detect(bitmap)
      for (const f of found) {
        const decoded = finish(f.rawValue, f.format.toUpperCase())
        if (decoded) return decoded
      }
      return null
    } finally {
      bitmap.close()
    }
  }

  const { reader, BarcodeFormat } = await createZxingReader()
  const url = URL.createObjectURL(file)
  try {
    const result = await reader.decodeFromImageUrl(url)
    return finish(result.getText(), BarcodeFormat[result.getBarcodeFormat()])
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
