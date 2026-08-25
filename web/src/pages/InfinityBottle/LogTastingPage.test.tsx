import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogTastingPage } from './LogTastingPage'
import type { InfinityBottle } from '../../data/types'

const mockNavigate = vi.fn()
const mockParams = { id: 'ib1' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

const mockAddTasting = vi.fn().mockResolvedValue(undefined)
let mockInfinityBottles: InfinityBottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: [], pours: [], memories: [], infinityBottles: mockInfinityBottles, customLibrary: [], people: [] },
    addTasting: mockAddTasting,
  }),
}))

vi.mock('../../features/infinityBottle/TastingForm', async () => {
  const actual = await vi.importActual<typeof import('../../features/infinityBottle/TastingForm')>(
    '../../features/infinityBottle/TastingForm',
  )
  return {
    ...actual,
    TastingForm: ({ onSubmit, submitLabel, submitting }: { onSubmit: () => void; submitLabel: string; submitting: boolean }) => (
      <button type="button" onClick={onSubmit} disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    ),
  }
})

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

beforeEach(() => {
  mockNavigate.mockClear()
  mockAddTasting.mockClear()
  mockInfinityBottles = [ib()]
})

describe('LogTastingPage', () => {
  it('shows an empty state when the Infinity Bottle cannot be found', () => {
    mockInfinityBottles = []
    render(<LogTastingPage />)
    expect(screen.getByText("We couldn't find that Infinity Bottle.")).toBeInTheDocument()
  })

  it('submitting the form calls addTasting and navigates to the Tastings route', async () => {
    render(<LogTastingPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Save Tasting' }))

    expect(mockAddTasting).toHaveBeenCalledWith('ib1', 'b1', expect.any(Object))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1/tastings')
  })
})
