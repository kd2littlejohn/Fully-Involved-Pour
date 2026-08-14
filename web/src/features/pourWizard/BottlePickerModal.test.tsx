import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottlePickerModal } from './BottlePickerModal'
import type { Bottle, Pour } from '../../data/types'

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' },
  { id: 'b2', name: 'Weller 12', distillery: 'Buffalo Trace', status: 'sealed' },
  { id: 'b3', name: 'Blanton\'s', distillery: 'Buffalo Trace', status: 'sealed' },
]

const pours: Pour[] = [
  { id: 'p1', bottleId: 'b3', date: '2026-08-01', rating: 8, fip: { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: 8, noseAromas: [], palateFlavors: [] } },
]

describe('BottlePickerModal', () => {
  it('shows an empty state when there are no bottles to pour', () => {
    render(<BottlePickerModal bottles={[]} onPick={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('No bottles to pour yet.')).toBeInTheDocument()
  })

  it('groups a bottle with a recent pour under Recently Poured, not Open Bottles or All Bottles', () => {
    render(<BottlePickerModal bottles={bottles} pours={pours} onPick={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Recently Poured')).toBeInTheDocument()
    expect(screen.getByText('Open Bottles')).toBeInTheDocument()
    expect(screen.getByText('All Bottles')).toBeInTheDocument()
    // Eagle Rare is open with no pours -> Open Bottles; Weller 12 has neither -> All Bottles.
    expect(screen.getAllByRole('button', { name: /Blanton/ })).toHaveLength(1)
  })

  it('picks a bottle immediately on row click, with no separate Continue step', async () => {
    const onPick = vi.fn()
    render(<BottlePickerModal bottles={bottles} pours={[]} onPick={onPick} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Eagle Rare/ }))

    expect(onPick).toHaveBeenCalledWith('b1')
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
  })

  it('filters rows by name or distillery as the search query changes', async () => {
    render(<BottlePickerModal bottles={bottles} pours={[]} onPick={vi.fn()} onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'Weller')

    expect(screen.getByRole('button', { name: /Weller 12/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eagle Rare/ })).not.toBeInTheDocument()
  })

  it('shows a no-matches message when the search query matches nothing', async () => {
    render(<BottlePickerModal bottles={bottles} pours={[]} onPick={vi.fn()} onClose={vi.fn()} />)

    await userEvent.type(screen.getByRole('searchbox'), 'zzz-no-match')

    expect(screen.getByText(/No bottles match/)).toBeInTheDocument()
  })
})
