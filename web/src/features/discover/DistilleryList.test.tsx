import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DistilleryList } from './DistilleryList'

const mockLookup = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  lookupDistillery: (...args: unknown[]) => mockLookup(...args),
}))

const distilleries = [
  { name: 'Buffalo Trace', count: 3 },
  { name: 'Four Roses', count: 1 },
]

beforeEach(() => {
  mockLookup.mockReset()
})

describe('DistilleryList', () => {
  it('shows the favorite distillery and each distillery with its bottle count', () => {
    render(<DistilleryList distilleries={distilleries} />)

    expect(screen.getByText('Favorite Distillery')).toBeInTheDocument()
    expect(screen.getAllByText('Buffalo Trace').length).toBeGreaterThan(0)
    expect(screen.getByText('3 bottles')).toBeInTheDocument()
    expect(screen.getByText('1 bottle')).toBeInTheDocument()
  })

  it('fetches and shows distillery info on first expand, and does not refetch on collapse/re-expand', async () => {
    mockLookup.mockResolvedValue({
      known: true,
      location: 'Frankfort, Kentucky',
      founded: 1857,
      parentCompany: 'Sazerac Company',
      description: 'Known for high-rye and wheated bourbon mash bills.',
    })
    render(<DistilleryList distilleries={distilleries} />)

    const header = screen.getByRole('button', { name: /Buffalo Trace/ })
    await userEvent.click(header)

    expect(mockLookup).toHaveBeenCalledWith('Buffalo Trace')
    expect(await screen.findByText(/Frankfort, Kentucky/)).toBeInTheDocument()
    expect(screen.getByText(/founded 1857/)).toBeInTheDocument()
    expect(screen.getByText(/owned by Sazerac Company/)).toBeInTheDocument()
    expect(screen.getByText('Known for high-rye and wheated bourbon mash bills.')).toBeInTheDocument()

    await userEvent.click(header) // collapse
    await userEvent.click(header) // re-expand

    expect(mockLookup).toHaveBeenCalledTimes(1)
  })

  it('shows an honest message when the distillery is not known', async () => {
    mockLookup.mockResolvedValue({ known: false })
    render(<DistilleryList distilleries={distilleries} />)

    await userEvent.click(screen.getByRole('button', { name: /Buffalo Trace/ }))

    expect(await screen.findByText('No verified background info for this distillery yet.')).toBeInTheDocument()
  })
})
