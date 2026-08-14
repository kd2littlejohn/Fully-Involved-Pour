import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { YourTakeCard } from './YourTakeCard'
import type { Bottle } from '../../data/types'

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }

describe('YourTakeCard', () => {
  it('shows the given score, or a dash when there is none', () => {
    const { rerender } = render(<YourTakeCard bottle={bottle} score={9.2} onUpdate={vi.fn()} />)
    expect(screen.getByText('9.2')).toBeInTheDocument()

    rerender(<YourTakeCard bottle={bottle} score={undefined} onUpdate={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('reports a Buy Again pick', async () => {
    const onUpdate = vi.fn()
    render(<YourTakeCard bottle={bottle} score={9.2} onUpdate={onUpdate} />)

    await userEvent.click(screen.getByRole('button', { name: 'At MSRP' }))

    expect(onUpdate).toHaveBeenCalledWith({ buyAgain: 'at-msrp' })
  })

  it('reports a Would You Replace It pick', async () => {
    const onUpdate = vi.fn()
    render(<YourTakeCard bottle={bottle} score={9.2} onUpdate={onUpdate} />)

    const replaceSection = screen.getByText('Would you replace it?').parentElement!
    await userEvent.click(within(replaceSection).getByRole('button', { name: 'Maybe' }))

    expect(onUpdate).toHaveBeenCalledWith({ wouldReplace: 'maybe' })
  })

  it('marks the current buyAgain and wouldReplace picks as active', () => {
    render(<YourTakeCard bottle={{ ...bottle, buyAgain: 'absolutely', wouldReplace: 'yes' }} score={9.2} onUpdate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Absolutely' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles favorite status', async () => {
    const onUpdate = vi.fn()
    render(<YourTakeCard bottle={bottle} score={9.2} onUpdate={onUpdate} />)

    await userEvent.click(screen.getByRole('button', { name: /Add to Favorites/ }))

    expect(onUpdate).toHaveBeenCalledWith({ favorite: true })
  })

  it('shows Favorited state and unfavorites on click when already a favorite', async () => {
    const onUpdate = vi.fn()
    render(<YourTakeCard bottle={{ ...bottle, favorite: true }} score={9.2} onUpdate={onUpdate} />)

    expect(screen.getByRole('button', { name: /Favorited/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /Favorited/ }))

    expect(onUpdate).toHaveBeenCalledWith({ favorite: false })
  })
})
