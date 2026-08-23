import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EssentialFieldsCard, type EssentialFieldsValues } from './EssentialFieldsCard'

const mockLookup = vi.fn()
const mockLookupDistillery = vi.fn().mockResolvedValue({ known: false })

vi.mock('../../data/repositories/ai', () => ({
  lookupBottleInfo: (...args: unknown[]) => mockLookup(...args),
  lookupDistillery: (...args: unknown[]) => mockLookupDistillery(...args),
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
  mockLookupDistillery.mockReset()
  mockLookupDistillery.mockResolvedValue({ known: false })
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
    mockLookup.mockResolvedValue({
      known: true,
      distillery: 'Buffalo Trace',
      type: 'Bourbon',
      region: 'Kentucky',
      proof: 90,
      ageStatement: '10 Year',
      mashBillCorn: 75,
      mashBillRyeWheat: 21,
      mashBillMalted: 4,
    })
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
      expect.objectContaining({
        distillery: 'Buffalo Trace',
        type: 'Rye',
        region: 'Kentucky',
        proof: '90',
        ageStatement: '10 Year',
        mashBillCorn: '75',
        mashBillRyeWheat: '21',
        mashBillMalted: '4',
      }),
    )
  })

  it('shows a status message when Ask AI has no match', async () => {
    mockLookup.mockResolvedValue({ known: false })
    render(<EssentialFieldsCard values={{ ...baseValues, name: 'Made Up Bottle' }} onChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))

    expect(await screen.findByText('No close match yet. Keep typing, or save it manually.')).toBeInTheDocument()
  })

  it('never overwrites an existing mash bill value, even when AI returns a different one', async () => {
    mockLookup.mockResolvedValue({ known: true, mashBillCorn: 51, mashBillRyeWheat: 39, mashBillMalted: 10 })
    const onChange = vi.fn()
    render(<EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare', mashBillCorn: '75' }} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))

    expect(await screen.findByText(/AI filled in/)).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mashBillCorn: '75', mashBillRyeWheat: '39', mashBillMalted: '10' }),
    )
  })

  it('fetches and shows a brief distillery bio right after AI fills in the distillery', async () => {
    mockLookup.mockResolvedValue({ known: true, distillery: 'Buffalo Trace' })
    mockLookupDistillery.mockResolvedValue({
      known: true,
      location: 'Frankfort, Kentucky',
      founded: 1857,
      parentCompany: 'Sazerac Company',
      description: 'One of the oldest continuously operating distilleries in the US.',
    })
    const onChange = vi.fn()
    const { rerender } = render(<EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare' }} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))
    expect(await screen.findByText(/AI filled in Buffalo Trace/)).toBeInTheDocument()
    expect(mockLookupDistillery).toHaveBeenCalledWith('Buffalo Trace')

    // The bio is keyed to the current distillery value — it only appears once
    // the parent has applied the AI's patch, same as AddBottlePage's real onChange.
    rerender(<EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare', distillery: 'Buffalo Trace' }} onChange={onChange} />)

    expect(await screen.findByText(/One of the oldest continuously operating distilleries/)).toBeInTheDocument()
    expect(screen.getByText('Frankfort, Kentucky · founded 1857 · owned by Sazerac Company')).toBeInTheDocument()
  })

  it('does not fetch a distillery bio when the distillery was already filled in before asking AI', async () => {
    mockLookup.mockResolvedValue({ known: true, distillery: 'Buffalo Trace', type: 'Bourbon' })
    render(<EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare', distillery: 'Buffalo Trace' }} onChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))
    await screen.findByText(/AI filled in/)

    expect(mockLookupDistillery).not.toHaveBeenCalled()
  })

  it('shows nothing when the distillery bio lookup comes back unknown', async () => {
    mockLookup.mockResolvedValue({ known: true, distillery: 'Some New Craft Distillery' })
    mockLookupDistillery.mockResolvedValue({ known: false })
    const onChange = vi.fn()
    const { rerender } = render(<EssentialFieldsCard values={{ ...baseValues, name: 'Craft Bottle' }} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /Ask AI to fill in the rest/ }))
    await screen.findByText(/AI filled in Some New Craft Distillery/)
    rerender(<EssentialFieldsCard values={{ ...baseValues, name: 'Craft Bottle', distillery: 'Some New Craft Distillery' }} onChange={onChange} />)

    await waitFor(() => expect(mockLookupDistillery).toHaveBeenCalledWith('Some New Craft Distillery'))
    expect(screen.queryByText(/founded/)).not.toBeInTheDocument()
  })

  describe('auto-run', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('fires the lookup on its own once the name settles, with no button click', async () => {
      mockLookup.mockResolvedValue({ known: true, distillery: 'Buffalo Trace' })
      const onChange = vi.fn()
      const { rerender } = render(<EssentialFieldsCard values={baseValues} onChange={onChange} />)

      // Simulates the name field settling on its final value, the way real
      // typing eventually does — no button ever gets clicked in this test.
      rerender(<EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare' }} onChange={onChange} />)
      expect(mockLookup).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(900)

      expect(mockLookup).toHaveBeenCalledWith('Eagle Rare')
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ distillery: 'Buffalo Trace' }))
    })

    it('stays silent (no "no match" message) when the auto-run finds nothing', async () => {
      mockLookup.mockResolvedValue({ known: false })
      render(<EssentialFieldsCard values={{ ...baseValues, name: 'Some Obscure Bottle' }} onChange={vi.fn()} />)

      await vi.advanceTimersByTimeAsync(900)

      expect(mockLookup).toHaveBeenCalledWith('Some Obscure Bottle')
      expect(screen.queryByText('No close match yet. Keep typing, or save it manually.')).not.toBeInTheDocument()
    })

    it('does not re-run for a name it has already auto-looked-up', async () => {
      mockLookup.mockResolvedValue({ known: true, distillery: 'Buffalo Trace' })
      const { rerender } = render(<EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare' }} onChange={vi.fn()} />)

      await vi.advanceTimersByTimeAsync(900)
      expect(mockLookup).toHaveBeenCalledTimes(1)

      // A patch fills in distillery but the name itself is unchanged — a
      // parent re-render with the same name must not refire the lookup.
      rerender(<EssentialFieldsCard values={{ ...baseValues, name: 'Eagle Rare', distillery: 'Buffalo Trace' }} onChange={vi.fn()} />)
      await vi.advanceTimersByTimeAsync(900)

      expect(mockLookup).toHaveBeenCalledTimes(1)
    })

    it('does not auto-run when every fillable field is already populated', async () => {
      render(
        <EssentialFieldsCard
          values={{
            name: 'Eagle Rare',
            distillery: 'Buffalo Trace',
            type: 'Bourbon',
            proof: '90',
            ageStatement: '10 Year',
            region: 'Kentucky',
            mashBillCorn: '75',
            mashBillRyeWheat: '21',
            mashBillMalted: '4',
          }}
          onChange={vi.fn()}
        />,
      )

      await vi.advanceTimersByTimeAsync(900)

      expect(mockLookup).not.toHaveBeenCalled()
    })
  })
})
