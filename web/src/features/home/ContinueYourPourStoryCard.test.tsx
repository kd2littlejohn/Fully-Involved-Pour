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

  it('shows the recent score, last pour date, pour count, and note from the latest real pour', () => {
    const pours: Pour[] = [
      { id: 'p1', bottleId: 'b1', date: '2026-06-01', rating: 8.0, fip: minFip(8.0) },
      { id: 'p2', bottleId: 'b1', date: '2026-07-01', rating: 8.6, memory: 'Great porch pour.', fip: minFip(8.6) },
    ]
    renderCard(pours)

    expect(screen.getByText('8.6')).toBeInTheDocument()
    expect(screen.getByText(/Last poured/)).toBeInTheDocument()
    expect(screen.getByText('2 pours')).toBeInTheDocument()
    expect(screen.getByText('Great porch pour.')).toBeInTheDocument()
  })

  it('falls back to pour.notes for the recent note when memory is unset (Quick Pour case)', () => {
    const pours: Pour[] = [{ id: 'p1', bottleId: 'b1', date: '2026-07-01', rating: 8.6, notes: 'Solid nightcap.', fip: minFip(8.6) }]
    renderCard(pours)
    expect(screen.getByText('Solid nightcap.')).toBeInTheDocument()
  })

  it('offers a Pour Again action', () => {
    renderCard([{ id: 'p1', bottleId: 'b1', date: '2026-07-01', rating: 8.6, fip: minFip(8.6) }])
    expect(screen.getByRole('button', { name: 'Pour Again' })).toBeInTheDocument()
  })
})
