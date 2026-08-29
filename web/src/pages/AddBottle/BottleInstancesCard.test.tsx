import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottleInstancesCard, blankInstanceDraft, type InstanceDraft } from './BottleInstancesCard'

function drafts(count: number): InstanceDraft[] {
  return Array.from({ length: count }, (_, i) => blankInstanceDraft(`draft-${i}`))
}

describe('BottleInstancesCard', () => {
  it('shows Bottle 1 as a read-only preview of what was already entered above', () => {
    render(
      <BottleInstancesCard
        instance1={{ statusLabel: 'Opened', purchaseDate: '2026-08-15', price: '39.99', storeLocation: 'ABC Store' }}
        drafts={drafts(2)}
        onDraftsChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Bottle 1')).toBeInTheDocument()
    expect(screen.getByText('Opened')).toBeInTheDocument()
    expect(screen.getByText('2026-08-15 · $39.99 · ABC Store')).toBeInTheDocument()
    // No editable fields for Bottle 1 — it's a preview only.
    expect(screen.queryByLabelText(/Price paid/)).not.toBeInTheDocument()
  })

  it('lists a numbered, collapsible row for each additional bottle, defaulting to Sealed', () => {
    render(<BottleInstancesCard instance1={{ statusLabel: 'Opened' }} drafts={drafts(2)} onDraftsChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Bottle 2/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bottle 3/ })).toBeInTheDocument()
    expect(screen.getAllByText('Sealed')).toHaveLength(2)
  })

  it('expands a bottle row to reveal its optional fields', async () => {
    render(<BottleInstancesCard instance1={{ statusLabel: 'Sealed' }} drafts={drafts(1)} onDraftsChange={vi.fn()} />)
    expect(screen.queryByLabelText(/Price paid/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Bottle 2/ }))
    expect(screen.getByLabelText(/Price paid/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Store/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Purchase date/)).toBeInTheDocument()
  })

  it('reports a field change for the correct draft only', async () => {
    const onDraftsChange = vi.fn()
    const twoDrafts = drafts(2)
    render(<BottleInstancesCard instance1={{ statusLabel: 'Sealed' }} drafts={twoDrafts} onDraftsChange={onDraftsChange} />)

    await userEvent.click(screen.getByRole('button', { name: /Bottle 3/ }))
    await userEvent.type(screen.getByLabelText(/Store/), 'T')

    expect(onDraftsChange).toHaveBeenCalledWith([twoDrafts[0], { ...twoDrafts[1], storeLocation: 'T' }])
  })

  it('shows the nickname in the row title once set', async () => {
    const onDraftsChange = vi.fn()
    const oneDraft = drafts(1)
    const { rerender } = render(<BottleInstancesCard instance1={{ statusLabel: 'Sealed' }} drafts={oneDraft} onDraftsChange={onDraftsChange} />)

    await userEvent.click(screen.getByRole('button', { name: /Bottle 2/ }))
    await userEvent.type(screen.getByLabelText(/Nickname/), 'Total Wine')

    const labeled = [{ ...oneDraft[0]!, label: 'Total Wine' }]
    rerender(<BottleInstancesCard instance1={{ statusLabel: 'Sealed' }} drafts={labeled} onDraftsChange={onDraftsChange} />)
    expect(screen.getByText('Bottle 2 — Total Wine')).toBeInTheDocument()
  })

  it('"Same purchase details for all bottles" copies Bottle 1’s details onto every draft', async () => {
    const onDraftsChange = vi.fn()
    render(
      <BottleInstancesCard
        instance1={{ statusLabel: 'Sealed', purchaseDate: '2026-08-15', price: '39.99', storeLocation: 'ABC Store' }}
        drafts={drafts(2)}
        onDraftsChange={onDraftsChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Same purchase details for all bottles' }))

    expect(onDraftsChange).toHaveBeenCalledWith([
      expect.objectContaining({ purchaseDate: '2026-08-15', price: '39.99', storeLocation: 'ABC Store' }),
      expect.objectContaining({ purchaseDate: '2026-08-15', price: '39.99', storeLocation: 'ABC Store' }),
    ])
  })

  it('does not show the "same details" shortcut when there is nothing to copy to', () => {
    render(<BottleInstancesCard instance1={{ statusLabel: 'Sealed' }} drafts={[]} onDraftsChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Same purchase details/ })).not.toBeInTheDocument()
  })
})
