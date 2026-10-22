import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bottle } from '../../data/types'
import type { BarcodeLookupResult } from '../../data/repositories/barcode'
import { normalizeBarcode } from './gtin'
import { ScanBarcodeFlow } from './ScanBarcodeFlow'

const mockLookup = vi.fn()
const mockLookupGoogle = vi.fn()
const mockIdentifyLabel = vi.fn()
const mockStartLiveScan = vi.fn()
const mockUpdateBottle = vi.fn()
const mockAddBottleInstance = vi.fn()
let mockBottles: Bottle[] = []
let deliverScan: ((code: string) => void) | null = null

vi.mock('../../data/repositories/barcode', () => ({
  lookupBarcode: (...args: unknown[]) => mockLookup(...args),
  lookupBarcodeWithGoogle: (...args: unknown[]) => mockLookupGoogle(...args),
  identifyBottleLabel: (...args: unknown[]) => mockIdentifyLabel(...args),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: mockBottles }, updateBottle: mockUpdateBottle, addBottleInstance: mockAddBottleInstance }),
}))

vi.mock('./decoder', () => ({
  startLiveScan: (...args: unknown[]) => mockStartLiveScan(...args),
  decodeImageFile: vi.fn().mockResolvedValue(null),
}))

const GTIN = '0036000291452'
const verified = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  distillery: 'Example Distillery',
  brand: null,
  expression: null,
  category: 'Bourbon',
  sizeMl: 750,
  proof: null,
  proofVaries: true,
  ageStatement: null,
  releaseKind: 'barrel-proof-batch' as const,
  batch: null,
  barrel: null,
  storePick: null,
  releaseYear: null,
  ...extra,
})
const lookupResult = (overrides: Partial<BarcodeLookupResult> = {}): BarcodeLookupResult => ({
  gtin13: GTIN,
  upcA: '036000291452',
  symbology: 'UPC_A',
  status: 'matched',
  verified: [verified('std', 'Example Bourbon', { releaseKind: 'standard', proof: 90, proofVaries: false }), verified('c924', 'Example Barrel Proof', { batch: 'C924', proof: 124.6, proofVaries: false })],
  yours: [],
  ...overrides,
})

const props = () => ({ onUse: vi.fn(), onUpdatedExisting: vi.fn(), onCancel: vi.fn() })

const SUGGESTIONS = '<div class="container"><a class="chip" href="https://www.google.com/search?q=036000291452">036000291452</a></div>'
const googleCandidate = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  distillery: 'Example Distillery',
  brand: null,
  expression: null,
  category: 'Bourbon',
  sizeMl: 750,
  releaseKind: 'standard' as const,
  proof: 90,
  proofVaries: false,
  ageStatement: null,
  notes: null,
  ...extra,
})
const googleFound = (overrides: Partial<NonNullable<BarcodeLookupResult['google']>['result']> = {}) =>
  lookupResult({
    status: 'suggested',
    verified: [],
    google: {
      status: 'identified',
      searchEntryPoint: SUGGESTIONS,
      result: {
        identified: true,
        upcSharedAcrossVariants: true,
        confidence: 'high',
        sources: [{ url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'example.com' }],
        notes: null,
        label: null,
        candidates: [
          googleCandidate('axe-1', 'Google Bourbon'),
          googleCandidate('axe-2', 'Google Bourbon Barrel Proof', { releaseKind: 'barrel-proof-batch', proof: null, proofVaries: true }),
        ],
        ...overrides,
      },
    },
  })

beforeEach(() => {
  mockLookup.mockReset()
  mockLookupGoogle.mockReset()
  mockIdentifyLabel.mockReset()
  mockUpdateBottle.mockReset()
  mockAddBottleInstance.mockReset()
  mockBottles = []
  deliverScan = null
  mockStartLiveScan.mockReset()
  mockStartLiveScan.mockImplementation(async (_video: unknown, onDecoded: (d: unknown) => void) => {
    deliverScan = (code) => {
      const normalized = normalizeBarcode(code)
      if (normalized.error === undefined) onDecoded({ raw: code, format: normalized.symbology, engine: 'zxing', normalized, msToDecode: 500 })
    }
    return { stop: vi.fn(), stats: { engine: 'zxing', msToCamera: 200, rejectedReads: 0 } }
  })
})

async function scan(code = '036000291452') {
  await waitFor(() => expect(deliverScan).not.toBeNull())
  deliverScan?.(code)
}

describe('ScanBarcodeFlow', () => {
  it('opens the camera, then lists every verified release for the barcode — no AI', async () => {
    mockLookup.mockResolvedValue(lookupResult())
    render(<ScanBarcodeFlow {...props()} />)
    expect(mockStartLiveScan).toHaveBeenCalledTimes(1)
    await scan()
    expect(await screen.findByText('This barcode can be 2 different bottles. Pick yours.')).toBeInTheDocument()
    expect(mockLookup).toHaveBeenCalledWith(GTIN)
    expect(screen.getByText('036000291452')).toBeInTheDocument()
  })

  it('hands the picked release to the Add Bottle form for My Bar or Wishlist', async () => {
    mockLookup.mockResolvedValue(lookupResult())
    const p = props()
    render(<ScanBarcodeFlow {...p} />)
    await scan()
    await userEvent.click(await screen.findByRole('button', { name: /Example Barrel Proof/ }))
    expect(screen.getByLabelText('Batch (from your label)')).toHaveValue('C924')
    await userEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))
    expect(p.onUse).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'wishlist',
        gtin13: GTIN,
        printedBarcode: '036000291452',
        origin: 'verified',
        candidateId: 'c924',
        bottle: expect.objectContaining({ name: 'Example Barrel Proof', batch: 'C924', proof: 124.6 }),
      }),
    )
  })

  it('asks AXE only when the user taps it', async () => {
    mockLookup.mockResolvedValueOnce(lookupResult({ status: 'no-match', verified: [] }))
    mockLookup.mockResolvedValueOnce(
      lookupResult({
        status: 'suggested',
        verified: [],
        axe: {
          identified: true,
          upcSharedAcrossVariants: false,
          confidence: 'medium',
          sources: [{ url: 'https://example.com/p', title: 'Example' }],
          notes: null,
          label: null,
          cached: false,
          candidates: [{ id: 'axe-1', name: 'Suggested Bourbon', distillery: null, brand: null, expression: null, category: 'Bourbon', sizeMl: 750, releaseKind: 'standard', proof: 90, proofVaries: false, ageStatement: null, notes: null }],
        },
      }),
    )
    render(<ScanBarcodeFlow {...props()} />)
    await scan()
    expect(await screen.findByText("No match in FIP's catalog yet.")).toBeInTheDocument()
    expect(mockLookup).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Ask AXE about this barcode' }))
    expect(mockLookup).toHaveBeenLastCalledWith(GTIN, { useAxe: true })
    expect(await screen.findByText('AXE suggestion · not verified')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Example' })).toHaveAttribute('href', 'https://example.com/p')
  })

  it('offers Increase quantity for a release already in My Bar and saves it there', async () => {
    mockBottles = [{ id: 'b1', name: 'Example Bourbon', distillery: 'Example Distillery', status: 'sealed', upc: '036000291452' }]
    mockLookup.mockResolvedValue(lookupResult())
    const p = props()
    render(<ScanBarcodeFlow {...p} />)
    await scan()
    expect(await screen.findByText('In your bar')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Example Bourbon/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    await waitFor(() => expect(p.onUpdatedExisting).toHaveBeenCalledWith('b1'))
    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', expect.objectContaining({ quantity: 2 }))
    expect(p.onUse).not.toHaveBeenCalled()
  })

  it('explains a blocked camera and still offers typing the digits', async () => {
    mockStartLiveScan.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    mockLookup.mockResolvedValue(lookupResult())
    render(<ScanBarcodeFlow {...props()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Camera access is off for FIP')
    await userEvent.type(screen.getByLabelText('Or type the barcode digits'), '036000291452')
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByText('This barcode can be 2 different bottles. Pick yours.')).toBeInTheDocument()
  })

  it('rejects typed digits that fail the check digit, without a lookup', async () => {
    render(<ScanBarcodeFlow {...props()} />)
    await userEvent.type(screen.getByLabelText('Or type the barcode digits'), '036000291453')
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }))
    expect(screen.getByRole('alert')).toHaveTextContent('aren’t a valid UPC or EAN')
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it('never looks up a store’s own price label', async () => {
    render(<ScanBarcodeFlow {...props()} />)
    await scan('212345678909')
    expect(await screen.findByText(/That’s a store’s own price label/)).toBeInTheDocument()
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it('goes straight to manual entry when asked', async () => {
    const p = props()
    render(<ScanBarcodeFlow {...p} />)
    await userEvent.click(screen.getByRole('button', { name: 'Enter details manually' }))
    await userEvent.type(screen.getByLabelText(/Bottle name/), 'Typed Bottle')
    await userEvent.click(screen.getByRole('button', { name: 'Add to My Bar' }))
    expect(p.onUse).toHaveBeenCalledWith(expect.objectContaining({ status: 'sealed', gtin13: null, printedBarcode: null, origin: 'manual' }))
  })

  describe('Google first for an unknown barcode', () => {
    it('searches Google automatically when FIP’s catalog has no match, and shows its sources and Search Suggestions', async () => {
      mockLookup.mockResolvedValue(lookupResult({ status: 'no-match', verified: [], googleAvailable: true }))
      mockLookupGoogle.mockResolvedValue(googleFound())
      render(<ScanBarcodeFlow {...props()} />)
      await scan()
      expect(await screen.findByText('This barcode can be 2 different bottles. Pick yours.')).toBeInTheDocument()
      expect(mockLookupGoogle).toHaveBeenCalledWith(GTIN)
      expect(screen.getAllByText('Google suggestion · not verified')).toHaveLength(2)
      expect(screen.getAllByRole('link', { name: 'example.com' })[0]).toHaveAttribute('href', 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc')
      expect(screen.getByTitle('Google Search suggestions')).toHaveAttribute('srcdoc', expect.stringContaining(SUGGESTIONS))
      // A variable-proof release never shows a proof.
      expect(screen.getByText(/Barrel-proof batch · Example Distillery · 750 ml · Proof varies/)).toBeInTheDocument()
      // AXE stays one tap away, but isn't called.
      expect(screen.getByRole('button', { name: 'Ask AXE about this barcode' })).toBeInTheDocument()
      expect(mockLookup).toHaveBeenCalledTimes(1)
    })

    it('does not ask Google when the catalog already knows the barcode', async () => {
      mockLookup.mockResolvedValue(lookupResult({ googleAvailable: true }))
      render(<ScanBarcodeFlow {...props()} />)
      await scan()
      expect(await screen.findByText('This barcode can be 2 different bottles. Pick yours.')).toBeInTheDocument()
      expect(mockLookupGoogle).not.toHaveBeenCalled()
    })

    it('does not ask Google when it is switched off', async () => {
      mockLookup.mockResolvedValue(lookupResult({ status: 'no-match', verified: [], googleAvailable: false }))
      render(<ScanBarcodeFlow {...props()} />)
      await scan()
      expect(await screen.findByText("No match in FIP's catalog yet.")).toBeInTheDocument()
      expect(mockLookupGoogle).not.toHaveBeenCalled()
    })

    it('offers AXE when Google can’t identify the barcode, and keeps both answers listed', async () => {
      mockLookup.mockResolvedValueOnce(lookupResult({ status: 'no-match', verified: [], googleAvailable: true }))
      mockLookupGoogle.mockResolvedValue(lookupResult({ status: 'not-found', verified: [], google: { status: 'not-found', searchEntryPoint: SUGGESTIONS, result: { identified: false, candidates: [], upcSharedAcrossVariants: false, confidence: 'low', sources: [], notes: null, label: null } } }))
      mockLookup.mockResolvedValueOnce(
        lookupResult({
          status: 'suggested',
          verified: [],
          axe: { identified: true, upcSharedAcrossVariants: false, confidence: 'medium', sources: [{ url: 'https://example.com/p', title: 'Example' }], notes: null, label: null, cached: false, candidates: [googleCandidate('axe-1', 'AXE Bourbon')] },
        }),
      )
      render(<ScanBarcodeFlow {...props()} />)
      await scan()
      expect(await screen.findByText(/Google couldn’t identify this barcode/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Ask AXE about this barcode' }))
      expect(await screen.findByText('AXE suggestion · not verified')).toBeInTheDocument()
      expect(mockLookup).toHaveBeenLastCalledWith(GTIN, { useAxe: true })
    })

    it('falls back to AXE when Google errors', async () => {
      mockLookup.mockResolvedValue(lookupResult({ status: 'no-match', verified: [], googleAvailable: true }))
      mockLookupGoogle.mockRejectedValue(new Error('network'))
      render(<ScanBarcodeFlow {...props()} />)
      await scan()
      expect(await screen.findByText(/Google search isn’t available right now/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ask AXE about this barcode' })).toBeInTheDocument()
    })

    it('hands a Google suggestion on as origin google, never offered to FIP’s catalog', async () => {
      mockLookup.mockResolvedValue(lookupResult({ status: 'no-match', verified: [], googleAvailable: true }))
      mockLookupGoogle.mockResolvedValue(googleFound())
      const p = props()
      render(<ScanBarcodeFlow {...p} />)
      await scan()
      await userEvent.click(await screen.findByRole('button', { name: /Google Bourbon Barrel Proof/ }))
      expect(screen.getByText(/A Google suggestion — not verified/)).toBeInTheDocument()
      expect(screen.getByTitle('Google Search suggestions')).toBeInTheDocument()
      expect(screen.getByLabelText(/Proof/)).toHaveValue('')
      expect(screen.queryByText(/Suggest this bottle for FIP's shared catalog/)).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Add to My Bar' }))
      expect(p.onUse).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'google',
          submitForReview: false,
          bottle: expect.objectContaining({ name: 'Google Bourbon Barrel Proof', proof: null, proofVaries: true, batch: null, barrel: null, storePick: null }),
        }),
      )
    })

    it('flags a low-confidence Google answer and points to AXE', async () => {
      mockLookup.mockResolvedValue(lookupResult({ status: 'no-match', verified: [], googleAvailable: true }))
      mockLookupGoogle.mockResolvedValue(googleFound({ confidence: 'low' }))
      render(<ScanBarcodeFlow {...props()} />)
      await scan()
      expect(await screen.findByText(/Google isn’t sure about this one/)).toBeInTheDocument()
    })
  })

  describe('camera', () => {
    it('explains a camera that opened without a picture', async () => {
      mockStartLiveScan.mockRejectedValue(Object.assign(new Error('black'), { name: 'CameraNoPictureError' }))
      render(<ScanBarcodeFlow {...props()} />)
      expect(await screen.findByRole('alert')).toHaveTextContent('The camera opened but showed no picture')
      expect(screen.getByRole('button', { name: 'Scan Barcode' })).toBeInTheDocument()
    })

    it('offers a tap to start when the phone blocks auto-play, then scans with the same stream', async () => {
      const stream = { getTracks: () => [] } as unknown as MediaStream
      mockStartLiveScan.mockRejectedValueOnce(Object.assign(new Error('tap'), { name: 'CameraNeedsTapError', stream }))
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      render(<ScanBarcodeFlow {...props()} />)
      await userEvent.click(await screen.findByRole('button', { name: 'Tap to start the camera' }))
      expect(play).toHaveBeenCalled()
      await waitFor(() => expect(mockStartLiveScan).toHaveBeenCalledTimes(2))
      expect(mockStartLiveScan.mock.calls[1]?.[2]).toMatchObject({ stream })
      play.mockRestore()
    })

    it('cancels a camera still starting when the screen closes', async () => {
      let signal: AbortSignal | undefined
      mockStartLiveScan.mockImplementation((_v: unknown, _cb: unknown, opts: { signal: AbortSignal }) => {
        signal = opts.signal
        return new Promise(() => {})
      })
      const { unmount } = render(<ScanBarcodeFlow {...props()} />)
      await waitFor(() => expect(signal).toBeDefined())
      unmount()
      expect(signal?.aborted).toBe(true)
    })
  })
})
