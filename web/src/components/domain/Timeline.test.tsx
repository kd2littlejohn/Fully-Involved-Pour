import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Timeline, type TimelineEvent } from './Timeline'

const events: TimelineEvent[] = [
  { id: 'added', date: '2026-01-01', label: 'Added to collection' },
  { id: 'pour-p1', date: '2026-02-01', label: 'Pour Story — 8.2', detail: 'Porch time', pourId: 'p1', bottleId: 'b1' },
]

describe('Timeline', () => {
  it('renders every event as plain, non-interactive rows when no onEventClick is given', () => {
    render(<Timeline events={events} />)

    expect(screen.getByText('Added to collection')).toBeInTheDocument()
    expect(screen.getByText('Pour Story — 8.2')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('only makes events backed by a real pour clickable', () => {
    render(<Timeline events={events} onEventClick={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Added to collection/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pour Story — 8.2/ })).toBeInTheDocument()
  })

  it('calls onEventClick with the clicked event', async () => {
    const onEventClick = vi.fn()
    render(<Timeline events={events} onEventClick={onEventClick} />)

    await userEvent.click(screen.getByRole('button', { name: /Pour Story — 8.2/ }))

    expect(onEventClick).toHaveBeenCalledWith(events[1])
  })
})
