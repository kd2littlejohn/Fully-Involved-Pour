import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BlendBreakdownPage } from './BlendBreakdownPage'
import type { Bottle, InfinityBottle } from '../../data/types'

const mockNavigate = vi.fn()
const mockParams = { id: 'ib1' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

let mockBottles: Bottle[] = []
let mockInfinityBottles: InfinityBottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: mockBottles, pours: [], memories: [], infinityBottles: mockInfinityBottles, customLibrary: [], people: [] },
  }),
}))

function ib(overrides: Partial<InfinityBottle> = {}): InfinityBottle {
  return {
    id: 'ib1',
    name: 'Backdraft Batch',
    archived: false,
    createdAt: 1,
    batches: [
      {
        id: 'b1',
        name: 'First Due',
        status: 'active',
        startedAt: 1,
        additions: [],
        tastings: [],
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockBottles = []
  mockInfinityBottles = [ib()]
})

describe('BlendBreakdownPage', () => {
  it('shows an empty state when the Infinity Bottle cannot be found', () => {
    mockInfinityBottles = []
    render(<BlendBreakdownPage />)
    expect(screen.getByText("We couldn't find that Infinity Bottle.")).toBeInTheDocument()
  })

  it('shows an empty composition state when nothing has been blended yet', () => {
    render(<BlendBreakdownPage />)
    expect(screen.getByText('Nothing blended yet.')).toBeInTheDocument()
  })

  it('renders composition percentages, sorted largest first, with an "Unavailable" proof state and note', () => {
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [
              { id: 'a1', bottleName: 'Eagle Rare', amountMl: 40, date: '2026-01-01', createdAt: 1, proof: 90 },
              { id: 'a2', bottleName: 'Mystery Bottle', amountMl: 60, date: '2026-01-02', createdAt: 2 },
            ],
            tastings: [],
          },
        ],
      }),
    ]
    render(<BlendBreakdownPage />)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByText('Add a proof to every bottle in this blend to see an estimate.')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('shows a real estimated proof figure once every contributing addition has one', () => {
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [{ id: 'a1', bottleName: 'Eagle Rare', amountMl: 40, date: '2026-01-01', createdAt: 1, proof: 90 }],
            tastings: [],
          },
        ],
      }),
    ]
    render(<BlendBreakdownPage />)
    expect(screen.getByText('90.0')).toBeInTheDocument()
  })

  it('shows the Why I Added It note in the Blend Timeline', () => {
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [{ id: 'a1', bottleName: 'Eagle Rare', amountMl: 40, date: '2026-01-01', createdAt: 1, note: 'Last of the bottle' }],
            tastings: [],
          },
        ],
      }),
    ]
    render(<BlendBreakdownPage />)
    expect(screen.getByText('Why I Added It: Last of the bottle')).toBeInTheDocument()
  })

  it('shows a compact Current Take from the latest tasting', () => {
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [],
            tastings: [
              { id: 't1', date: '2026-01-01', score: 8.5, noseAromas: ['Vanilla'], palateFlavors: ['Caramel'], overallNotes: 'Great balance.', createdAt: 1 },
            ],
          },
        ],
      }),
    ]
    render(<BlendBreakdownPage />)
    expect(screen.getByText('Current Take')).toBeInTheDocument()
    expect(screen.getByText('8.5')).toBeInTheDocument()
    expect(screen.getByText('Vanilla, Caramel')).toBeInTheDocument()
    expect(screen.getByText('Great balance.')).toBeInTheDocument()
  })

  it('does not render Current Take when there are no tastings', () => {
    render(<BlendBreakdownPage />)
    expect(screen.queryByText('Current Take')).not.toBeInTheDocument()
  })

  it('shows the goal badge when the batch has a goal', () => {
    mockInfinityBottles = [
      ib({
        batches: [{ id: 'b1', status: 'active', startedAt: 1, goal: 'more-oak', additions: [], tastings: [] }],
      }),
    ]
    render(<BlendBreakdownPage />)
    expect(screen.getByText('Goal: More Oak')).toBeInTheDocument()
  })

  it('makes a composition/timeline row tappable to Bottle Details only when the source bottle still exists', async () => {
    mockBottles = [{ id: 'src1', name: 'Eagle Rare', status: 'open' }]
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [
              { id: 'a1', bottleName: 'Eagle Rare', sourceBottleId: 'src1', amountMl: 40, date: '2026-01-01', createdAt: 1 },
              { id: 'a2', bottleName: 'Gone Bottle', sourceBottleId: 'deleted-id', amountMl: 60, date: '2026-01-02', createdAt: 2 },
            ],
            tastings: [],
          },
        ],
      }),
    ]
    render(<BlendBreakdownPage />)

    const linkedRow = screen.getAllByText('Eagle Rare')[0]!.closest('button')
    expect(linkedRow).not.toBeNull()
    await userEvent.click(linkedRow!)
    expect(mockNavigate).toHaveBeenCalledWith('/collection/src1')

    const goneRow = screen.getAllByText('Gone Bottle')[0]!.closest('div')
    expect(goneRow?.tagName).toBe('DIV')
  })

  it('the "..." action navigates to Batch Management', async () => {
    render(<BlendBreakdownPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Batch management' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1/manage')
  })
})
