import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OwnershipFieldsCard, type OwnershipFieldsValues } from './OwnershipFieldsCard'

const baseValues: OwnershipFieldsValues = {
  status: 'sealed',
  price: '',
  storeLocation: '',
  openedDate: '',
  notes: '',
}

describe('OwnershipFieldsCard', () => {
  it('is collapsed by default and expands on toggle', async () => {
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} />)

    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Your Bottle' }))

    expect(screen.getByLabelText('Status')).toBeInTheDocument()
  })

  it('only offers the four real bottle statuses', async () => {
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Your Bottle' }))

    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Sealed', 'Opened', 'Finished', 'Wish List'])
  })

  it('only shows Opened date when status is open', async () => {
    render(<OwnershipFieldsCard values={{ ...baseValues, status: 'open' }} onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Your Bottle' }))

    expect(screen.getByLabelText('Opened date')).toBeInTheDocument()
  })

  it('hides Opened date when status is sealed', async () => {
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Your Bottle' }))

    expect(screen.queryByLabelText('Opened date')).not.toBeInTheDocument()
  })

  it('reports changes via onChange', async () => {
    const onChange = vi.fn()
    render(<OwnershipFieldsCard values={baseValues} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Your Bottle' }))

    await userEvent.type(screen.getByLabelText('Store (optional)'), 'A')

    expect(onChange).toHaveBeenCalledWith({ storeLocation: 'A' })
  })
})
