import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MaybeTonightCard } from './MaybeTonightCard'
import type { Bottle } from '../../data/types'

const mockUseUserData = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

const bottle: Bottle = { id: 'b1', name: 'Stagg Barrel Proof 25A', distillery: 'Buffalo Trace', status: 'sealed' }

function renderCard() {
  mockUseUserData.mockReturnValue({ userDoc: { bottles: [bottle], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
  return render(
    <MemoryRouter>
      <MaybeTonightCard candidate={{ bottle, reason: 'Still sealed.' }} />
    </MemoryRouter>,
  )
}

describe('MaybeTonightCard', () => {
  it('shows the bottle name and its honest reason, kept secondary (no distillery line)', () => {
    renderCard()
    expect(screen.getByText('Stagg Barrel Proof 25A')).toBeInTheDocument()
    expect(screen.getByText('Still sealed.')).toBeInTheDocument()
    expect(screen.queryByText('Buffalo Trace')).not.toBeInTheDocument()
  })

  it('offers a Pour action for the bottle', () => {
    renderCard()
    expect(screen.getByRole('button', { name: 'Pour' })).toBeInTheDocument()
  })
})
