import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewTab } from './OverviewTab'
import type { Bottle, Pour } from '../../../data/types'

const mockUseFipGuide = vi.fn()

vi.mock('../../../features/bottleDetails/useFipGuide', () => ({
  useFipGuide: (...args: unknown[]) => mockUseFipGuide(...args),
}))

// PalateMatchBadge is exercised on its own in features/palateMatch/
// PalateMatchBadge.test.tsx — here it just needs to not touch real Firebase.
vi.mock('../../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] } }),
}))

const eagleRare: Bottle = {
  id: 'b1',
  name: 'Eagle Rare 10 Year',
  distillery: 'Buffalo Trace Distillery',
  type: 'Bourbon',
  region: 'Kentucky',
  proof: 90,
  ageStatement: '10 Year',
  msrp: 44.99,
  bottleSize: 750,
  mashBillCorn: 75,
  mashBillRyeWheat: 10,
  mashBillMalted: 4,
  status: 'open',
  price: 39.99,
  purchaseDate: '2026-06-01',
  openedDate: '2026-06-14',
  storeLocation: 'Total Wine',
  favorite: true,
}

function renderTab(bottle: Bottle, pours: Pour[] = []) {
  return render(<OverviewTab bottle={bottle} pours={pours} />)
}

describe('OverviewTab', () => {
  beforeEach(() => {
    mockUseFipGuide.mockReset()
  })

  it('always shows Your Bottle with at least the real Status, even for a bare-minimum bottle', () => {
    mockUseFipGuide.mockReturnValue({ state: 'none', guide: undefined })
    renderTab({ id: 'b2', name: 'Mystery Bottle', status: 'sealed' })

    expect(screen.getByText('Your Bottle')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Sealed')).toBeInTheDocument()
  })

  it('splits canonical Bottle Info from personal Your Bottle facts, never mixing them', () => {
    mockUseFipGuide.mockReturnValue({ state: 'none', guide: undefined })
    renderTab(eagleRare)

    expect(screen.getByText('Bottle Info')).toBeInTheDocument()
    expect(screen.getByText('Distillery')).toBeInTheDocument()
    expect(screen.getByText('Buffalo Trace Distillery')).toBeInTheDocument()
    expect(screen.getByText('Mash Bill')).toBeInTheDocument()
    expect(screen.getByText('75% Corn / 10% Rye/Wheat / 4% Malted Barley')).toBeInTheDocument()
    expect(screen.getByText('Release')).toBeInTheDocument()
    expect(screen.getAllByText('Eagle Rare 10 Year').length).toBeGreaterThan(0)
    // MSRP shown as an approximate reference figure...
    expect(screen.getByText('~$45')).toBeInTheDocument()

    expect(screen.getByText('Your Bottle')).toBeInTheDocument()
    // ...distinct from the exact Price Paid in Your Bottle.
    expect(screen.getByText('$39.99')).toBeInTheDocument()
    expect(screen.getByText('Store')).toBeInTheDocument()
    expect(screen.getByText('Total Wine')).toBeInTheDocument()
    expect(screen.getByText('Favorite')).toBeInTheDocument()
  })

  it('formats purchase and opened dates using the timezone-safe local parse', () => {
    mockUseFipGuide.mockReturnValue({ state: 'none', guide: undefined })
    renderTab(eagleRare)

    expect(screen.getByText('Jun 1, 2026')).toBeInTheDocument()
    expect(screen.getByText('Jun 14, 2026')).toBeInTheDocument()
  })

  it('only shows Availability in Bottle Info once the FIP Guide resolves with one', () => {
    mockUseFipGuide.mockReturnValue({ state: 'none', guide: undefined })
    const { rerender } = renderTab(eagleRare)
    expect(screen.queryByText('Availability')).not.toBeInTheDocument()

    mockUseFipGuide.mockReturnValue({
      state: 'ready',
      guide: {
        bottleKey: 'k',
        confidence: 'high',
        story: null,
        special: [],
        expectSummary: '',
        expectFlavors: [],
        buyIf: [],
        passIf: [],
        verdict: '',
        availability: 'Limited',
        intensity: null,
        generatedAt: Date.now(),
      },
    })
    rerender(<OverviewTab bottle={eagleRare} pours={[]} />)

    expect(screen.getByText('Availability')).toBeInTheDocument()
    expect(screen.getByText('Limited')).toBeInTheDocument()
  })

  it('never shows a Bottle Phase row when the bottle has no journey stage', () => {
    mockUseFipGuide.mockReturnValue({ state: 'none', guide: undefined })
    // A sealed bottle has no journey stage (that's an open-bottle-only concept).
    renderTab({ id: 'b3', name: 'Still Sealed', status: 'sealed' })

    expect(screen.queryByText('Bottle Phase')).not.toBeInTheDocument()
  })

  it('shows a Bottle Phase row for an open bottle', () => {
    mockUseFipGuide.mockReturnValue({ state: 'none', guide: undefined })
    renderTab({ id: 'b4', name: 'Freshly Opened', status: 'open', openedDate: new Date().toISOString().slice(0, 10) })

    expect(screen.getByText('Bottle Phase')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('shows personal Flavor Notes chips and Notes when present, independent of the FIP Guide', () => {
    mockUseFipGuide.mockReturnValue({ state: 'none', guide: undefined })
    renderTab({ ...eagleRare, flavors: ['caramel', 'oak'], notes: 'A reliable daily pour.' })

    expect(screen.getByText('Flavor Notes')).toBeInTheDocument()
    expect(screen.getByText('caramel')).toBeInTheDocument()
    expect(screen.getByText('oak')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('A reliable daily pour.')).toBeInTheDocument()
  })

  it('omits Bottle Info entirely for a bottle with no canonical facts beyond its own name', () => {
    mockUseFipGuide.mockReturnValue({ state: 'none', guide: undefined })
    renderTab({ id: 'b5', name: 'Nameless', status: 'wishlist' })

    // Release always shows (it's just the bottle name), so Bottle Info
    // itself still renders — but none of the optional canonical fields do.
    expect(screen.queryByText('Distillery')).not.toBeInTheDocument()
    expect(screen.queryByText('Proof')).not.toBeInTheDocument()
    expect(screen.queryByText('Mash Bill')).not.toBeInTheDocument()
  })
})
