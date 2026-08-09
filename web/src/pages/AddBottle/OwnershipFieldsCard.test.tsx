import { render, screen } from '@testing-library/react'
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
  storeLocation: '',
  openedDate: '',
  expectedDate: '',
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

  it('only shows Opened date when status is open', async () => {
    render(<OwnershipFieldsCard values={{ ...baseValues, status: 'open' }} onChange={vi.fn()} bottleContext={emptyContext} />)
    await openCard()

    expect(screen.getByLabelText('Opened date')).toBeInTheDocument()
  })

  it('hides Opened date when status is sealed', async () => {
    render(<OwnershipFieldsCard values={baseValues} onChange={vi.fn()} bottleContext={emptyContext} />)
    await openCard()

    expect(screen.queryByLabelText('Opened date')).not.toBeInTheDocument()
  })

  it('only shows Expected arrival when status is incoming', async () => {
    render(<OwnershipFieldsCard values={{ ...baseValues, status: 'incoming' }} onChange={vi.fn()} bottleContext={emptyContext} />)
    await openCard()

    expect(screen.getByLabelText('Expected arrival (optional)')).toBeInTheDocument()
  })

  it('reports changes via onChange', async () => {
    const onChange = vi.fn()
    render(<OwnershipFieldsCard values={baseValues} onChange={onChange} bottleContext={emptyContext} />)
    await openCard()

    await userEvent.type(screen.getByLabelText('Store (optional)'), 'A')

    expect(onChange).toHaveBeenCalledWith({ storeLocation: 'A' })
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
