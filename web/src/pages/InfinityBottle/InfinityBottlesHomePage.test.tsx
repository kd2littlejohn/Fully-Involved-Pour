import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InfinityBottlesHomePage } from './InfinityBottlesHomePage'
import type { InfinityBottle } from '../../data/types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

const mockCreateInfinityBottle = vi.fn().mockResolvedValue('new-ib-id')
let mockInfinityBottles: InfinityBottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: [], pours: [], memories: [], infinityBottles: mockInfinityBottles, customLibrary: [], people: [] },
    createInfinityBottle: mockCreateInfinityBottle,
  }),
}))

beforeEach(() => {
  mockNavigate.mockClear()
  mockCreateInfinityBottle.mockClear()
  mockInfinityBottles = []
})

function activeBatch(overrides: Partial<InfinityBottle> = {}): InfinityBottle {
  return {
    id: 'ib1',
    name: 'Backdraft Batch',
    capacityMl: 1000,
    archived: false,
    createdAt: 1,
    batches: [
      {
        id: 'b1',
        name: 'First Due',
        status: 'active',
        startedAt: 1,
        additions: [{ id: 'a1', bottleName: 'Eagle Rare', sourceBottleId: 'src1', proof: 90, amountMl: 400, date: '2026-01-01', createdAt: 1 }],
        tastings: [{ id: 't1', date: '2026-01-05', score: 8.5, noseAromas: [], palateFlavors: [], createdAt: 1 }],
      },
    ],
    ...overrides,
  }
}

describe('InfinityBottlesHomePage', () => {
  it('shows the empty state and creates a new Infinity Bottle', async () => {
    render(<InfinityBottlesHomePage />)
    expect(screen.getByText('Create Your Infinity Bottle')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Create Infinity Bottle' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Backdraft Batch')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Infinity Bottle' }))

    expect(mockCreateInfinityBottle).toHaveBeenCalledWith({ name: 'Backdraft Batch', capacityMl: undefined })
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/new-ib-id')
  })

  it('shows the featured card with volume, proof, score, and source count for the active batch', () => {
    mockInfinityBottles = [activeBatch()]
    render(<InfinityBottlesHomePage />)

    expect(screen.getByText('Backdraft Batch - First Due')).toBeInTheDocument()
    expect(screen.getByText('Current Batch')).toBeInTheDocument()
    expect(screen.getByText('400ml / 1000ml')).toBeInTheDocument()
    expect(screen.getByText('90.0')).toBeInTheDocument()
    expect(screen.getByText('1 source bottles')).toBeInTheDocument()
  })

  it('shows "Unavailable" for estimated proof when the blend has incomplete proof data', () => {
    mockInfinityBottles = [
      activeBatch({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [{ id: 'a1', bottleName: 'Mystery Bottle', amountMl: 100, date: '2026-01-01', createdAt: 1 }],
            tastings: [],
          },
        ],
      }),
    ]
    render(<InfinityBottlesHomePage />)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('renders additional vessels under "Other Infinity Bottles"', () => {
    mockInfinityBottles = [
      activeBatch(),
      activeBatch({ id: 'ib2', name: 'House Blend #1', batches: [{ id: 'b2', status: 'complete', startedAt: 1, additions: [], tastings: [] }] }),
    ]
    render(<InfinityBottlesHomePage />)
    expect(screen.getByText('Other Infinity Bottles')).toBeInTheDocument()
    expect(screen.getByText('House Blend #1')).toBeInTheDocument()
    expect(screen.getByText('Batch Complete')).toBeInTheDocument()
  })

  it('the Archived tab shows archived vessels instead of the active one', async () => {
    mockInfinityBottles = [activeBatch(), activeBatch({ id: 'ib2', name: 'Retired Blend', archived: true })]
    render(<InfinityBottlesHomePage />)

    await userEvent.click(screen.getByRole('tab', { name: 'Archived' }))

    expect(screen.queryByText('Backdraft Batch - First Due')).not.toBeInTheDocument()
    expect(screen.getByText('Retired Blend - First Due')).toBeInTheDocument()
  })

  it('View Blend navigates to the Blend Breakdown route', async () => {
    mockInfinityBottles = [activeBatch()]
    render(<InfinityBottlesHomePage />)
    await userEvent.click(screen.getByRole('button', { name: 'View Blend' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1')
  })
})
