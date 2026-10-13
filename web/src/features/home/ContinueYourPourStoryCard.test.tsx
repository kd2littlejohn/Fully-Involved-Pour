import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ContinueYourPourStoryCard } from './ContinueYourPourStoryCard'
import type { Bottle, Pour } from '../../data/types'

const mockUseUserData = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' }

function minFip(rating: number) {
  return { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: rating, noseAromas: [], palateFlavors: [] }
}

function renderCard(pours: Pour[]) {
  mockUseUserData.mockReturnValue({ userDoc: { bottles: [bottle], pours, memories: [], infinityBottles: [], customLibrary: [], people: [] } })
  return render(
    <MemoryRouter>
      <ContinueYourPourStoryCard bottle={bottle} pours={pours} />
    </MemoryRouter>,
  )
}

describe('ContinueYourPourStoryCard', () => {
  it('shows an honest hint instead of fabricating pour stats when there are none yet', () => {
    renderCard([])
    expect(screen.getByText(/No pours logged yet/)).toBeInTheDocument()
  })

  it('shows the latest score, its local-calendar date, and the pour count in one compact row', () => {
    const pours: Pour[] = [
      { id: 'p1', bottleId: 'b1', date: '2026-06-01', rating: 8.0, fip: minFip(8.0) },
      { id: 'p2', bottleId: 'b1', date: '2026-07-01', rating: 8.6, memory: 'Great porch pour.', fip: minFip(8.6) },
    ]
    renderCard(pours)

    expect(screen.getByText('8.6')).toBeInTheDocument()
    // The stored calendar day, never shifted by a UTC parse.
    expect(screen.getByText('Last tasted Jul 1, 2026 · 2 pours')).toBeInTheDocument()
    // Compact: the note stays on the bottle's own page.
    expect(screen.queryByText('Great porch pour.')).not.toBeInTheDocument()
  })

  it('offers a Pour Again action', () => {
    renderCard([{ id: 'p1', bottleId: 'b1', date: '2026-07-01', rating: 8.6, fip: minFip(8.6) }])
    expect(screen.getByRole('button', { name: 'Pour Again' })).toBeInTheDocument()
  })
})
