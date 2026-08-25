import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TastingsPage } from './TastingsPage'
import type { InfinityBottle } from '../../data/types'

const mockNavigate = vi.fn()
const mockParams = { id: 'ib1' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

let mockInfinityBottles: InfinityBottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: [], pours: [], memories: [], infinityBottles: mockInfinityBottles, customLibrary: [], people: [] },
  }),
}))

vi.mock('../../features/infinityBottle/TastingDetailModal', () => ({
  TastingDetailModal: ({ tasting, onClose }: { tasting: { id: string }; onClose: () => void }) => (
    <div role="dialog" aria-label="Tasting detail">
      <span>Viewing {tasting.id}</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}))

function ib(overrides: Partial<InfinityBottle> = {}): InfinityBottle {
  return {
    id: 'ib1',
    name: 'Backdraft Batch',
    archived: false,
    createdAt: 1,
    batches: [{ id: 'b1', name: 'First Due', status: 'active', startedAt: 1, additions: [], tastings: [] }],
    ...overrides,
  }
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockInfinityBottles = [ib()]
})

describe('TastingsPage', () => {
  it('shows an empty state when the Infinity Bottle cannot be found', () => {
    mockInfinityBottles = []
    render(<TastingsPage />)
    expect(screen.getByText("We couldn't find that Infinity Bottle.")).toBeInTheDocument()
  })

  it('shows an empty tasting history state with no tastings', () => {
    render(<TastingsPage />)
    expect(screen.getByText('No tastings yet.')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('shows current and average score stats', () => {
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [],
            tastings: [
              { id: 't1', date: '2026-01-01', score: 6, noseAromas: [], palateFlavors: [], createdAt: 1 },
              { id: 't2', date: '2026-02-01', score: 8, noseAromas: [], palateFlavors: [], createdAt: 2 },
            ],
          },
        ],
      }),
    ]
    render(<TastingsPage />)
    expect(screen.getAllByText('8.0').length).toBeGreaterThan(0)
    expect(screen.getByText('7.0')).toBeInTheDocument()
  })

  it('only shows the score evolution chart once there are at least 2 tastings', () => {
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [],
            tastings: [{ id: 't1', date: '2026-01-01', score: 6, noseAromas: [], palateFlavors: [], createdAt: 1 }],
          },
        ],
      }),
    ]
    const { rerender } = render(<TastingsPage />)
    expect(screen.queryByRole('img', { name: 'Score evolution over your tastings' })).not.toBeInTheDocument()

    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [],
            tastings: [
              { id: 't1', date: '2026-01-01', score: 6, noseAromas: [], palateFlavors: [], createdAt: 1 },
              { id: 't2', date: '2026-02-01', score: 8, noseAromas: [], palateFlavors: [], createdAt: 2 },
            ],
          },
        ],
      }),
    ]
    rerender(<TastingsPage />)
    expect(screen.getByRole('img', { name: 'Score evolution over your tastings' })).toBeInTheDocument()
  })

  it('Log New Tasting navigates to the Log Tasting route', async () => {
    render(<TastingsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Log New Tasting' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1/tastings/new')
  })

  it('clicking a history row opens the Tasting Detail modal for that tasting', async () => {
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [],
            tastings: [{ id: 't1', date: '2026-01-01', score: 6, noseAromas: [], palateFlavors: [], createdAt: 1 }],
          },
        ],
      }),
    ]
    render(<TastingsPage />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Dec 31, 2025'))
    expect(screen.getByText('Viewing t1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
