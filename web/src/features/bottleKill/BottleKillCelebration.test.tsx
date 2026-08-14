import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottleKillCelebration } from './BottleKillCelebration'
import type { Bottle, Pour } from '../../data/types'

const bottle: Bottle = { id: 'b1', name: 'Weller Antique 107', status: 'finished', openedDate: '2026-04-14' }

function pour(overrides: Partial<Pour>): Pour {
  return {
    id: 'p',
    bottleId: 'b1',
    date: '2026-05-01',
    rating: 9.2,
    fip: { nose: 2.3, palate: 3.2, finish: 1.8, complexity: 0.9, value: 1.0, total: 9.2, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

describe('BottleKillCelebration', () => {
  it('tells the real story: pour count, final score, and buy-again answer', () => {
    const pours = [pour({ id: 'p1', date: '2026-04-20', rating: 7.5, buyAgain: 'maybe' }), pour({ id: 'p2', date: '2026-08-10', buyAgain: 'absolutely' })]

    render(<BottleKillCelebration bottle={bottle} pours={pours} onClose={vi.fn()} />)

    expect(screen.getByText(/You finished Weller Antique 107 after 2 pours/)).toBeInTheDocument()
    expect(screen.getByText('9.2')).toBeInTheDocument()
    expect(screen.getByText('Final Score')).toBeInTheDocument()
    expect(screen.getByText('Absolutely')).toBeInTheDocument()
    expect(screen.getByText('Would Replace?')).toBeInTheDocument()
  })

  it('uses singular "pour" for exactly one pour', () => {
    render(<BottleKillCelebration bottle={bottle} pours={[pour({})]} onClose={vi.fn()} />)

    expect(screen.getByText(/after 1 pour /)).toBeInTheDocument()
  })

  it('does not fabricate a final score or buy-again answer when there is no real data', () => {
    render(<BottleKillCelebration bottle={{ ...bottle, openedDate: undefined }} pours={[]} onClose={vi.fn()} />)

    expect(screen.getByText('You finished Weller Antique 107.')).toBeInTheDocument()
    expect(screen.queryByText('Final Score')).not.toBeInTheDocument()
    expect(screen.queryByText('Would Replace?')).not.toBeInTheDocument()
  })

  it('closes via the dismiss button', async () => {
    const onClose = vi.fn()
    render(<BottleKillCelebration bottle={bottle} pours={[pour({})]} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Nice.' }))

    expect(onClose).toHaveBeenCalled()
  })
})
