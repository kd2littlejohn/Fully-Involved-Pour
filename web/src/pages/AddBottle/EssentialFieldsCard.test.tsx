import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EssentialFieldsCard, type EssentialFieldsValues } from './EssentialFieldsCard'

const mockLookup = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  lookupBottleInfo: (...args: unknown[]) => mockLookup(...args),
}))

const baseValues: EssentialFieldsValues = {
  name: '',
  distillery: '',
  type: '',
  proof: '',
  ageStatement: '',
  region: '',
  mashBillCorn: '',
  mashBillRyeWheat: '',
  mashBillMalted: '',
}

beforeEach(() => {
  mockLookup.mockReset()
})

describe('EssentialFieldsCard', () => {
  it('reports field changes via onChange', async () => {
    const onChange = vi.fn()
    render(<EssentialFieldsCard values={baseValues} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Bottle name', { exact: false }), 'E')

    expect(onChange).toHaveBeenCalledWith({ name: 'E' })
  })

  it('shows the name error when provided', () => {
    render(<EssentialFieldsCard values={baseValues} onChange={vi.fn()} nameError="Bottle name is required." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Bottle name is required.')
  })

  it('disables Ask AI until the name is at least 3 characters', () => {
    render(<EssentialFieldsCard values={{ ...baseValues, name: 'Ea' }} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Ask AI to fill in the rest/ })).toBeDisabled()
  })

  it('fills in empty fields from a successful Ask AI lookup, without overwriting existing values', async () => {
    mockLookup.mockResolvedValue({ known: true, distillery: 'Buffalo Trace', type: 'Bourbon', region: 'Kentucky', proof: 90 })
    const onChange = vi.fn()
    render(
      <EssentialFieldsCard
        values={{ ...baseValues, name: 'Eagle Rare', type: 'Rye' }}
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))

    expect(mockLookup).toHaveBeenCalledWith('Eagle Rare')
    expect(await screen.findByText(/AI filled in Buffalo Trace/)).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ distillery: 'Buffalo Trace', type: 'Rye', region: 'Kentucky', proof: '90' }),
    )
  })

  it('reports a found MSRP via onMsrpFound without touching essential fields', async () => {
    mockLookup.mockResolvedValue({ known: true, distillery: 'Buffalo Trace', type: 'Bourbon', region: 'Kentucky', proof: 90, msrp: 40 })
    const onMsrpFound = vi.fn()
    render(
      <EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare' }} onChange={vi.fn()} onMsrpFound={onMsrpFound} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))

    expect(await screen.findByText(/AI filled in Buffalo Trace/)).toBeInTheDocument()
    expect(onMsrpFound).toHaveBeenCalledWith(40)
  })

  it('fills in mash bill percentages from a successful Ask AI lookup', async () => {
    mockLookup.mockResolvedValue({
      known: true,
      distillery: 'Buffalo Trace',
      type: 'Bourbon',
      region: 'Kentucky',
      proof: 90,
      mashBillCorn: 75,
      mashBillRyeWheat: 13,
      mashBillMalted: 12,
    })
    const onChange = vi.fn()
    render(<EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare' }} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))

    expect(await screen.findByText(/AI filled in Buffalo Trace/)).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mashBillCorn: '75', mashBillRyeWheat: '13', mashBillMalted: '12' }),
    )
  })

  it('shows a status message when Ask AI has no match', async () => {
    mockLookup.mockResolvedValue({ known: false })
    render(<EssentialFieldsCard values={{ ...baseValues, name: 'Made Up Bottle' }} onChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))

    expect(await screen.findByText('No close match yet. Keep typing, or save it manually.')).toBeInTheDocument()
  })
})
