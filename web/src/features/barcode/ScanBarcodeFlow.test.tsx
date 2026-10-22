import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bottle } from '../../data/types'
import type { BarcodeLookupResult } from '../../data/repositories/barcode'
import { normalizeBarcode } from './gtin'
import { ScanBarcodeFlow } from './ScanBarcodeFlow'

const mockLookup = vi.fn()
const mockIdentifyLabel = vi.fn()
const mockStartLiveScan = vi.fn()
const mockUpdateBottle = vi.fn()
const mockAddBottleInstance = vi.fn()
let mockBottles: Bottle[] = []
let deliverScan: ((code: string) => void) | null = null

vi.mock('../../data/repositories/barcode', () => ({
  lookupBarcode: (...args: unknown[]) => mockLookup(...args),
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

beforeEach(() => {
  mockLookup.mockReset()
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
})
