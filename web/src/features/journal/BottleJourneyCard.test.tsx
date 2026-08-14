import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottleJourneyCard } from './BottleJourneyCard'
import type { Bottle, Pour } from '../../data/types'

function renderCard(bottle: Bottle, pours: Pour[]) {
  return render(
    <MemoryRouter>
      <BottleJourneyCard bottle={bottle} pours={pours} />
    </MemoryRouter>,
  )
}

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' }

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return {
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

describe('BottleJourneyCard', () => {
  it('shows an honest hint instead of fabricating evolution with fewer than 2 pours', () => {
    renderCard(bottle, [pour({ id: 'p1', bottleId: 'b1', date: '2026-08-01', rating: 8.5 })])
    expect(screen.getByText(/Log another pour/)).toBeInTheDocument()
    expect(screen.queryByText('Neck Pour')).not.toBeInTheDocument()
  })

  it('shows the real score evolution once there are 2+ pours', () => {
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: '2026-08-01', rating: 8.5 }),
      pour({ id: 'p2', bottleId: 'b1', date: '2026-08-10', rating: 9.0 }),
    ]
    renderCard(bottle, pours)
    expect(screen.getByText('Neck Pour')).toBeInTheDocument()
    expect(screen.getByText('8.5')).toBeInTheDocument()
    expect(screen.getByText('9.0')).toBeInTheDocument()
  })

  it('links to the bottle details route', () => {
    renderCard(bottle, [])
    expect(screen.getByRole('link')).toHaveAttribute('href', '/collection/b1')
  })
})
