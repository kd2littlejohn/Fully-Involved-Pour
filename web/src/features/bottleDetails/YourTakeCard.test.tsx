import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { YourTakeCard } from './YourTakeCard'
import type { Bottle } from '../../data/types'
import type { PourHistorySummary } from './selectors'

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }
const noPours: PourHistorySummary = { pourCount: 0 }

function renderCard(overrides: Partial<Parameters<typeof YourTakeCard>[0]> = {}) {
  return render(
    <YourTakeCard
      bottle={bottle}
      score={9.2}
      pourHistory={noPours}
      onUpdate={vi.fn()}
      onViewJourney={vi.fn()}
      {...overrides}
    />,
  )
}

describe('YourTakeCard', () => {
  it('shows the given score, or a dash when there is none', () => {
    const { rerender } = renderCard({ score: 9.2 })
    expect(screen.getByText('9.2')).toBeInTheDocument()

    rerender(
      <YourTakeCard bottle={bottle} score={undefined} pourHistory={noPours} onUpdate={vi.fn()} onViewJourney={vi.fn()} />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows the FIP tier name and a star rating for a real score', () => {
    renderCard({ score: 9.2 })
    // 9.2 -> "Fully Involved" per the FIP tier table.
    expect(screen.getByText('Fully Involved')).toBeInTheDocument()
    expect(screen.getByLabelText('5 of 5 stars')).toBeInTheDocument()
  })

  it('shows no tier or stars when there is no score yet', () => {
    render(<YourTakeCard bottle={bottle} score={undefined} pourHistory={noPours} onUpdate={vi.fn()} onViewJourney={vi.fn()} />)

    expect(screen.queryByLabelText(/of 5 stars/)).not.toBeInTheDocument()
  })

  it('shows the rating date only when one is given', () => {
    const { rerender } = renderCard({ score: 9.2, scoreDate: '2026-07-18' })
    expect(screen.getByText('Rated on Jul 18, 2026')).toBeInTheDocument()

    rerender(<YourTakeCard bottle={bottle} score={9.2} pourHistory={noPours} onUpdate={vi.fn()} onViewJourney={vi.fn()} />)
    expect(screen.queryByText(/Rated on/)).not.toBeInTheDocument()
  })

  it('shows First Poured, Last Poured, and Pours Logged when there is real pour history', () => {
    renderCard({ pourHistory: { firstPouredDate: '2026-06-14', lastPouredDate: '2026-07-18', pourCount: 6 } })

    expect(screen.getByText('First Poured')).toBeInTheDocument()
    expect(screen.getByText('Jun 14, 2026')).toBeInTheDocument()
    expect(screen.getByText('Last Poured')).toBeInTheDocument()
    expect(screen.getByText('Jul 18, 2026')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('Pours Logged')).toBeInTheDocument()
  })

  it('hides the pour history stats entirely when the bottle has never been poured', () => {
    renderCard({ pourHistory: noPours })

    expect(screen.queryByText('First Poured')).not.toBeInTheDocument()
    expect(screen.queryByText(/Pours? Logged/)).not.toBeInTheDocument()
  })

  it('calls onViewJourney when View My Journey is tapped', async () => {
    const onViewJourney = vi.fn()
    renderCard({ onViewJourney })

    await userEvent.click(screen.getByRole('button', { name: /View My Journey/ }))

    expect(onViewJourney).toHaveBeenCalled()
  })

  it('reports a Buy Again pick', async () => {
    const onUpdate = vi.fn()
    renderCard({ onUpdate })

    await userEvent.click(screen.getByRole('button', { name: 'At MSRP' }))

    expect(onUpdate).toHaveBeenCalledWith({ buyAgain: 'at-msrp' })
  })

  it('reports a Would You Replace It pick', async () => {
    const onUpdate = vi.fn()
    renderCard({ onUpdate })

    const replaceSection = screen.getByText('Would you replace it?').parentElement!
    await userEvent.click(within(replaceSection).getByRole('button', { name: 'Maybe' }))

    expect(onUpdate).toHaveBeenCalledWith({ wouldReplace: 'maybe' })
  })

  it('marks the current buyAgain and wouldReplace picks as active', () => {
    renderCard({ bottle: { ...bottle, buyAgain: 'absolutely', wouldReplace: 'yes' } })

    expect(screen.getByRole('button', { name: 'Absolutely' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')
  })
})
