import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { YourPalateSection } from './YourPalateSection'
import type { Bottle, Pour } from '../../data/types'

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

describe('YourPalateSection', () => {
  it('shows an honest teaser and no claims at 0 pours', () => {
    render(<YourPalateSection bottles={[bourbon]} pours={[]} />)
    expect(screen.getByText('Your palate starts here.')).toBeInTheDocument()
    expect(screen.queryByText('You seem to gravitate toward')).not.toBeInTheDocument()
    expect(screen.queryByText('Taste Patterns')).not.toBeInTheDocument()
  })

  it('shows a factual summary with no radar or patterns at 1 pour', () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8.4 })]
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)
    expect(screen.getByText(/logged 1 pour so far, averaging 8.4/)).toBeInTheDocument()
    expect(screen.queryByText(/gravitate toward/)).not.toBeInTheDocument()
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
    expect(screen.getByText('You seem to gravitate toward')).toBeInTheDocument()
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

  it('labels a single-category collection honestly as "most poured" rather than a favorite', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: daysAgo(1), rating: 8 }),
      pour({ id: 'p2', bottleId: 'b1', date: daysAgo(2), rating: 8 }),
      pour({ id: 'p3', bottleId: 'b1', date: daysAgo(3), rating: 8 }),
    ]
    render(<YourPalateSection bottles={[bourbon]} pours={pours} />)
    expect(screen.getByText(/Bourbon is your most poured style so far\./)).toBeInTheDocument()
  })
})
