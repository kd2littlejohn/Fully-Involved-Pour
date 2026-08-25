import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddToBlendPage } from './AddToBlendPage'
import type { Bottle, InfinityBottle } from '../../data/types'

const mockNavigate = vi.fn()
const mockParams = { id: 'ib1' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

const mockAddBlendAddition = vi.fn().mockResolvedValue(undefined)
let mockBottles: Bottle[] = []
let mockInfinityBottles: InfinityBottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: mockBottles, pours: [], memories: [], infinityBottles: mockInfinityBottles, customLibrary: [], people: [] },
    addBlendAddition: mockAddBlendAddition,
  }),
}))

function ib(overrides: Partial<InfinityBottle> = {}): InfinityBottle {
  return {
    id: 'ib1',
    name: 'Backdraft Batch',
    archived: false,
    createdAt: 1,
    batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }],
    ...overrides,
  }
}

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'name'>): Bottle {
  return { status: 'open', ...overrides }
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockAddBlendAddition.mockClear()
  mockInfinityBottles = [ib()]
  mockBottles = [
    bottle({ id: 'b1', name: 'Eagle Rare', proof: 90, bottleSize: 750, fillLevel: 'half' }),
    bottle({ id: 'b2', name: 'Weller 12', proof: 90, status: 'sealed' }),
    bottle({ id: 'b3', name: 'Blanton\'s', proof: 93 }),
  ]
})

describe('AddToBlendPage', () => {
  it('only lists open bottles and filters by search', async () => {
    render(<AddToBlendPage />)
    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.getByText('Blanton\'s')).toBeInTheDocument()
    expect(screen.queryByText('Weller 12')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Search your bottles'), 'eagle')
    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Blanton\'s')).not.toBeInTheDocument()
  })

  it('shows bottle size and fill level instead of a fabricated available volume', () => {
    render(<AddToBlendPage />)
    expect(screen.getByText('90 Proof · 750ml bottle')).toBeInTheDocument()
    expect(screen.getByText('About Half Full')).toBeInTheDocument()
  })

  it('quick amount buttons set the amount field', async () => {
    render(<AddToBlendPage />)
    await userEvent.click(screen.getByText('Eagle Rare').closest('button')!)
    await userEvent.click(screen.getByRole('button', { name: '60ml' }))
    expect(screen.getByLabelText('Amount to add (ml)')).toHaveValue(60)
  })

  it('converts quick amounts when the unit is switched to oz', async () => {
    render(<AddToBlendPage />)
    await userEvent.click(screen.getByRole('button', { name: 'oz' }))
    await userEvent.click(screen.getByRole('button', { name: '2oz' }))
    expect(screen.getByLabelText('Amount to add (oz)')).toHaveValue(2)
  })

  it('disables the submit button until a bottle and a positive amount are set', async () => {
    render(<AddToBlendPage />)
    expect(screen.getByRole('button', { name: /Add 0ml to Blend/ })).toBeDisabled()

    const eagleRow = screen.getByText('Eagle Rare').closest('button')!
    await userEvent.click(eagleRow)
    expect(screen.getByRole('button', { name: /Add 0ml to Blend/ })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '60ml' }))
    expect(screen.getByRole('button', { name: /Add 60ml to Blend/ })).toBeEnabled()
  })

  it('submits a full snapshot addition and navigates to the Blend Breakdown', async () => {
    render(<AddToBlendPage />)
    await userEvent.click(screen.getByText('Eagle Rare').closest('button')!)
    await userEvent.click(screen.getByRole('button', { name: '60ml' }))
    await userEvent.type(screen.getByLabelText('Why are you adding this? (optional)'), 'Last of the bottle')
    await userEvent.click(screen.getByRole('button', { name: /Add 60ml to Blend/ }))

    expect(mockAddBlendAddition).toHaveBeenCalledWith(
      'ib1',
      'b1',
      expect.objectContaining({
        sourceBottleId: 'b1',
        bottleName: 'Eagle Rare',
        proof: 90,
        amountMl: 60,
        note: 'Last of the bottle',
      }),
    )
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1')
  })

  it('shows an empty state when the Infinity Bottle cannot be found', () => {
    mockInfinityBottles = []
    render(<AddToBlendPage />)
    expect(screen.getByText("We couldn't find that Infinity Bottle.")).toBeInTheDocument()
  })
})
