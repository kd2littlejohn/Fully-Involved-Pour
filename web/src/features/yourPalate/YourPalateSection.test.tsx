import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YourPalateSection } from './YourPalateSection'
import type { Bottle, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUsePalateInterpretation = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('./usePalateInterpretation', () => ({
  usePalateInterpretation: (...args: unknown[]) => mockUsePalateInterpretation(...args),
}))

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
  mockUsePalateInterpretation.mockReturnValue({ state: 'none', interpretation: undefined })
})

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return {
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

const bourbon: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', type: 'Bourbon', proof: 90, flavors: ['Vanilla', 'Caramel'] }
const highProof: Bottle = { id: 'b2', name: 'Whistlepig 15', status: 'open', type: 'Rye', proof: 120 }

describe('YourPalateSection', () => {
  it('shows an honest teaser and no claims at 0 pours', () => {
    render(<YourPalateSection bottles={[bourbon]} pours={[]} />)
    expect(screen.getByText('Your palate starts here.')).toBeInTheDocument()
    expect(screen.queryByText('Flavors you’ve experienced most')).not.toBeInTheDocument()
    expect(screen.queryByText('Taste Patterns')).not.toBeInTheDocument()
  })

  it('shows a factual summary with no radar or patterns at 1 pour', () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8.4 })]
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)
    expect(screen.getByText(/logged 1 pour so far, averaging 8.4/)).toBeInTheDocument()
    expect(screen.queryByText(/experienced most/)).not.toBeInTheDocument()
    expect(screen.queryByText('Taste Patterns')).not.toBeInTheDocument()
    expect(screen.getByText(/A few more pours/)).toBeInTheDocument()
  })

  it('unlocks the flavor radar and gravitate-toward chips at 3 pours', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8 }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 8 }),
    ]
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)
    expect(screen.getByText(/logged 3 pours so far, averaging 8.0/)).toBeInTheDocument()
    expect(screen.getByText('Flavors you’ve experienced most')).toBeInTheDocument()
    expect(screen.getByText('Vanilla')).toBeInTheDocument()
    expect(screen.queryByText(/A few more pours/)).not.toBeInTheDocument()
  })

  it('does not show a Palate Evolution section below 6 pours', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8 }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 8 }),
    ]
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)
    expect(screen.queryByText('Palate Evolution')).not.toBeInTheDocument()
  })

  it('shows a Palate Evolution statement once 6+ pours exist', () => {
    const ratings = [6.0, 6.2, 6.1, 8.5, 8.7, 8.6]
    const pours = ratings.map((rating, i) => pour({ id: `p${i}`, bottleId: 'b1', date: daysAgo(10 - i), rating }))
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)
    expect(screen.getByText('Palate Evolution')).toBeInTheDocument()
    expect(screen.getByText(/up from/)).toBeInTheDocument()
  })

  it('adds a proof-trend line to Palate Evolution once a real shift shows in 6+ pours', () => {
    const pours = [
      pour({ id: 'p0', bottleId: 'b1', date: daysAgo(10), rating: 8 }),
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(9), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(8), rating: 8 }),
      pour({ id: 'p3', bottleId: 'b2', date: daysAgo(3), rating: 8 }),
      pour({ id: 'p4', bottleId: 'b2', date: daysAgo(2), rating: 8 }),
      pour({ id: 'p5', bottleId: 'b2', date: daysAgo(1), rating: 8 }),
    ]
    render(<YourPalateSection bottles={[bourbon, highProof]} pours={pours} />)
    expect(screen.getByText(/You used to average around 90 proof\. Lately, you've been averaging closer to 120 proof\./)).toBeInTheDocument()
  })

  it('shows flavors preferred separately from flavors experienced, once two different high-rated bottles support it', () => {
    const highRated = (id: string, bottleId: string, rating: number, tags: string[]): Pour => ({
      id,
      bottleId,
      date: daysAgo(1),
      rating,
      fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: rating, noseAromas: [], palateFlavors: tags },
    })
    const pours = [
      highRated('p1', 'b1', 9.0, ['Vanilla']),
      highRated('p2', 'b2', 8.5, ['Vanilla']),
      highRated('p3', 'b1', 8.2, ['Vanilla']),
    ]
    render(<YourPalateSection bottles={[bourbon, highProof]} pours={pours} />)
    const preferredLabel = screen.getByText('Flavors you tend to prefer')
    expect(preferredLabel.parentElement?.textContent).toContain('Vanilla')
  })

  it('shows an honest "not enough data" footnote for preferred flavors when every high-rated pour is the same single bottle', () => {
    // 3 pours clears the minimum sample size, but they're all the one bottle
    // — repeat tastings of a single favorite must not be presented as an
    // established, palate-wide preference.
    const untouched: Bottle = { id: 'b3', name: 'Untouched Bottle', status: 'sealed', flavors: ['Leather'] }
    const highRated = (id: string, rating: number): Pour => ({
      id,
      bottleId: 'b1',
      date: daysAgo(1),
      rating,
      fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: rating, noseAromas: [], palateFlavors: [] },
    })
    const pours = [highRated('p1', 9.0), highRated('p2', 8.5), highRated('p3', 8.2)]
    render(<YourPalateSection bottles={[bourbon, untouched]} pours={pours} />)
    expect(screen.queryByText('Flavors you tend to prefer')).not.toBeInTheDocument()
    expect(screen.getByText(/we.ll start showing flavors you tend to prefer/)).toBeInTheDocument()
    // 'Untouched Bottle' (b3) has never been poured — its static 'Leather'
    // flavors field must not leak into either flavor measurement.
    expect(screen.queryByText('Leather')).not.toBeInTheDocument()
  })

  it('excludes a never-poured bottle\'s static flavors from the "experienced" chips', () => {
    const untouched: Bottle = { id: 'b3', name: 'Untouched Bottle', status: 'sealed', flavors: ['Leather'] }
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8 }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 8 }),
    ]
    render(<YourPalateSection bottles={[bourbon, untouched]} pours={pours} />)
    // bourbon (b1) was actually poured, so its own static flavors still
    // legitimately count — only the untouched bottle's are excluded.
    expect(screen.getByText('Vanilla')).toBeInTheDocument()
    expect(screen.queryByText('Leather')).not.toBeInTheDocument()
  })

  it('labels a single-category collection honestly as "most poured" rather than a favorite', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8 }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 8 }),
    ]
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)
    expect(screen.getByText(/Bourbon is your most poured style so far\./)).toBeInTheDocument()
  })

  it('shows "What FIP Is Learning" once the interpretation is ready', () => {
    mockUsePalateInterpretation.mockReturnValue({
      state: 'ready',
      interpretation: "You've been leaning into Bourbon, especially pours with real vanilla character.",
    })
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })]
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)

    expect(screen.getByText('What FIP Is Learning')).toBeInTheDocument()
    expect(screen.getByText("You've been leaning into Bourbon, especially pours with real vanilla character.")).toBeInTheDocument()
  })

  it('never shows "What FIP Is Learning" while loading or with no interpretation available', () => {
    mockUsePalateInterpretation.mockReturnValue({ state: 'loading', interpretation: undefined })
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 })]
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)

    expect(screen.queryByText('What FIP Is Learning')).not.toBeInTheDocument()
  })
})
