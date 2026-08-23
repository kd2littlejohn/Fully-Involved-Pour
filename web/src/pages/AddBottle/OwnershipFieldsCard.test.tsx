import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OwnershipFieldsCard, type OwnershipFieldsValues, type BottleContext } from './OwnershipFieldsCard'

const mockGenerateTastingProfile = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  generateTastingProfile: (...args: unknown[]) => mockGenerateTastingProfile(...args),
}))

const baseValues: OwnershipFieldsValues = {
  status: 'sealed',
  price: '',
  msrp: '',
  storeLocation: '',
  quantity: '',
  purchaseDate: '',
  openedDate: '',
  expectedDate: '',
  finishedDate: '',
  notes: '',
}

const emptyContext: BottleContext = { name: '', distillery: '', type: '', proof: '' }
const eagleRareContext: BottleContext = { name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', type: 'Bourbon', proof: '90' }

beforeEach(() => {
  mockGenerateTastingProfile.mockReset()
})

async function openCard() {
  await userEvent.click(screen.getByRole('button', { name: 'Your Bottle' }))
}

describe('OwnershipFieldsCard', () => {
  it('is collapsed by default and expands on toggle', async () => {
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} bottleContext={emptyContext} />)

    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()

    await openCard()

    expect(screen.getByLabelText('Status')).toBeInTheDocument()
  })

  it('only offers the five real bottle statuses', async () => {
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} bottleContext={emptyContext} />)
    await openCard()

    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Sealed', 'Opened', 'Finished', 'Wish List', 'Incoming'])
  })

  it('shows all four date fields together, regardless of current status', async () => {
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} bottleContext={emptyContext} />)
    await openCard()

    expect(screen.getByLabelText('Purchase date (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Opened date (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Expected arrival (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Finished date (optional)')).toBeInTheDocument()
  })

  it('reports a Purchase date change via onChange', async () => {
    const onChange = vi.fn()
    render(<OwnershipFieldsCard values={baseValues} onChange={onChange} bottleContext={emptyContext} />)
    await openCard()

    fireEvent.change(screen.getByLabelText('Purchase date (optional)'), { target: { value: '2026-06-01' } })

    expect(onChange).toHaveBeenCalledWith({ purchaseDate: '2026-06-01' })
  })

  it('lets an Opened date be edited on a bottle that is no longer open', async () => {
    const onChange = vi.fn()
    render(
      <OwnershipFieldsCard
        values={{ ...baseValues, status: 'finished', openedDate: '2026-01-05' }}
        onChange={onChange}
        bottleContext={emptyContext}
      />,
    )
    await openCard()

    fireEvent.change(screen.getByLabelText('Opened date (optional)'), { target: { value: '2026-01-06' } })

    expect(onChange).toHaveBeenCalledWith({ openedDate: '2026-01-06' })
  })

  it('defaults Finished date to today when status changes to Finished', async () => {
    const onChange = vi.fn()
    render(<OwnershipFieldsCard values={baseValues} onChange={onChange} bottleContext={emptyContext} />)
    await openCard()

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Finished')

    const today = new Date().toISOString().slice(0, 10)
    expect(onChange).toHaveBeenCalledWith({ status: 'finished', finishedDate: today })
  })

  it('does not overwrite an already-set Finished date when status changes again', async () => {
    const onChange = vi.fn()
    render(
      <OwnershipFieldsCard
        values={{ ...baseValues, status: 'finished', finishedDate: '2026-01-05' }}
        onChange={onChange}
        bottleContext={emptyContext}
      />,
    )
    await openCard()

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Sealed')

    expect(onChange).toHaveBeenCalledWith({ status: 'sealed', finishedDate: '2026-01-05' })
  })

  it('leaves Finished date blank for a legacy finished bottle with no stored date', async () => {
    render(<OwnershipFieldsCard values={{ ...baseValues, status: 'finished' }} onChange={vi.fn()} bottleContext={emptyContext} />)
    await openCard()

    expect(screen.getByLabelText('Finished date (optional)')).toHaveValue('')
  })

  it('lets the user override the Finished date before saving', async () => {
    const onChange = vi.fn()
    render(
      <OwnershipFieldsCard
        values={{ ...baseValues, status: 'finished', finishedDate: '2026-08-10' }}
        onChange={onChange}
        bottleContext={emptyContext}
      />,
    )
    await openCard()

    fireEvent.change(screen.getByLabelText('Finished date (optional)'), { target: { value: '2026-08-05' } })

    expect(onChange).toHaveBeenCalledWith({ finishedDate: '2026-08-05' })
  })

  it('reports a Quantity change via onChange', async () => {
    const onChange = vi.fn()
    render(<OwnershipFieldsCard values={baseValues} onChange={onChange} bottleContext={emptyContext} />)
    await openCard()

    fireEvent.change(screen.getByLabelText('Quantity (optional)'), { target: { value: '3' } })

    expect(onChange).toHaveBeenCalledWith({ quantity: '3' })
  })

  it('reports changes via onChange', async () => {
    const onChange = vi.fn()
    render(<OwnershipFieldsCard values={baseValues} onChange={onChange} bottleContext={emptyContext} />)
    await openCard()

    await userEvent.type(screen.getByLabelText('Store (optional)'), 'A')

    expect(onChange).toHaveBeenCalledWith({ storeLocation: 'A' })
  })

  it('reports an MSRP change via onChange', async () => {
    const onChange = vi.fn()
    render(<OwnershipFieldsCard values={baseValues} onChange={onChange} bottleContext={emptyContext} />)
    await openCard()

    fireEvent.change(screen.getByLabelText('MSRP (optional)'), { target: { value: '40' } })

    expect(onChange).toHaveBeenCalledWith({ msrp: '40' })
  })

  it('disables the AI Tasting Note button until a bottle name is entered', async () => {
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} bottleContext={emptyContext} />)
    await openCard()

    expect(screen.getByRole('button', { name: /AI Tasting Note/ })).toBeDisabled()
  })

  it('generates a tasting note and fills the empty Bottle notes field', async () => {
    mockGenerateTastingProfile.mockResolvedValue({
      nose: 'Caramel and oak.',
      palate: 'Sweet vanilla.',
      finish: 'Warm and long.',
      flavors: ['caramel'],
    })
    const onChange = vi.fn()
    render(<OwnershipFieldsCard values={baseValues} onChange={onChange} bottleContext={eagleRareContext} />)
    await openCard()

    await userEvent.click(screen.getByRole('button', { name: /AI Tasting Note/ }))

    expect(mockGenerateTastingProfile).toHaveBeenCalledWith({
      bottleName: 'Eagle Rare 10 Year',
      distillery: 'Buffalo Trace',
      type: 'Bourbon',
      proof: 90,
    })
    expect(onChange).toHaveBeenCalledWith({ notes: 'Caramel and oak. Sweet vanilla. Warm and long.' })
    expect(await screen.findByText('✨ AI tasting note added below.')).toBeInTheDocument()
  })

  it('does not overwrite notes the user already wrote', async () => {
    mockGenerateTastingProfile.mockResolvedValue({ nose: 'Caramel.', palate: 'Vanilla.', finish: 'Long.', flavors: [] })
    const onChange = vi.fn()
    render(
      <OwnershipFieldsCard values={{ ...baseValues, notes: 'My own notes.' }} onChange={onChange} bottleContext={eagleRareContext} />,
    )
    await openCard()

    await userEvent.click(screen.getByRole('button', { name: /AI Tasting Note/ }))

    expect(onChange).toHaveBeenCalledWith({ notes: 'My own notes.' })
  })

  it('shows an error message when note generation fails', async () => {
    mockGenerateTastingProfile.mockRejectedValue(new Error('network down'))
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} bottleContext={eagleRareContext} />)
    await openCard()

    await userEvent.click(screen.getByRole('button', { name: /AI Tasting Note/ }))

    expect(await screen.findByText("The sommelier couldn't generate a note just now. Try again in a moment.")).toBeInTheDocument()
  })
})
