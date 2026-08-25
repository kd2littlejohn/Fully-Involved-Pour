import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchManagementPage } from './BatchManagementPage'
import type { InfinityBottle } from '../../data/types'

const mockNavigate = vi.fn()
const mockParams = { id: 'ib1' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

const mockUpdateInfinityBottle = vi.fn().mockResolvedValue(undefined)
const mockCompleteBatch = vi.fn().mockResolvedValue(undefined)
const mockStartNewBatch = vi.fn().mockResolvedValue(undefined)
const mockDeleteInfinityBottle = vi.fn().mockResolvedValue(undefined)
let mockInfinityBottles: InfinityBottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: [], pours: [], memories: [], infinityBottles: mockInfinityBottles, customLibrary: [], people: [] },
    updateInfinityBottle: mockUpdateInfinityBottle,
    completeBatch: mockCompleteBatch,
    startNewBatch: mockStartNewBatch,
    deleteInfinityBottle: mockDeleteInfinityBottle,
  }),
}))

vi.mock('../../features/photoUpload/PhotoUploadField', () => ({
  PhotoUploadField: ({ label }: { label: string }) => <div>{label}</div>,
}))

function ib(overrides: Partial<InfinityBottle> = {}): InfinityBottle {
  return {
    id: 'ib1',
    name: 'Backdraft Batch',
    archived: false,
    createdAt: 1,
    batches: [
      { id: 'b1', name: 'First Due', status: 'active', startedAt: 1, additions: [{ id: 'a1', bottleName: 'Eagle Rare', amountMl: 100, date: '2026-01-01', createdAt: 1 }], tastings: [] },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockUpdateInfinityBottle.mockClear()
  mockCompleteBatch.mockClear()
  mockStartNewBatch.mockClear()
  mockDeleteInfinityBottle.mockClear()
  mockInfinityBottles = [ib()]
})

describe('BatchManagementPage', () => {
  it('shows an empty state when the Infinity Bottle cannot be found', () => {
    mockInfinityBottles = []
    render(<BatchManagementPage />)
    expect(screen.getByText("We couldn't find that Infinity Bottle.")).toBeInTheDocument()
  })

  it('Edit Infinity Bottle saves name changes', async () => {
    render(<BatchManagementPage />)
    await userEvent.click(screen.getByRole('button', { name: /Edit Infinity Bottle/ }))
    const nameInput = screen.getByLabelText(/^Name/)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'House Blend')
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdateInfinityBottle).toHaveBeenCalledWith('ib1', expect.objectContaining({ name: 'House Blend' }))
  })

  it('Archive This Batch is hidden when the batch is already complete', () => {
    mockInfinityBottles = [ib({ batches: [{ id: 'b1', status: 'complete', startedAt: 1, additions: [], tastings: [] }] })]
    render(<BatchManagementPage />)
    expect(screen.queryByText('Archive This Batch')).not.toBeInTheDocument()
  })

  it('Archive This Batch confirm calls completeBatch', async () => {
    render(<BatchManagementPage />)
    await userEvent.click(screen.getByRole('button', { name: /Archive This Batch/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Archive This Batch' }))
    expect(mockCompleteBatch).toHaveBeenCalledWith('ib1', 'b1')
  })

  it('Start New Batch without carry-forward calls startNewBatch with no carryForwardMl', async () => {
    render(<BatchManagementPage />)
    await userEvent.click(screen.getByRole('button', { name: /Start New Batch/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start New Batch' }))

    expect(mockStartNewBatch).toHaveBeenCalledWith('ib1', { name: undefined, goal: undefined, carryForwardMl: undefined })
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1')
  })

  it('Start New Batch with carry-forward validates the amount is capped at the current volume', async () => {
    render(<BatchManagementPage />)
    await userEvent.click(screen.getByRole('button', { name: /Start New Batch/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Carry Forward Some' }))

    const amountInput = within(dialog).getByLabelText(/Amount to carry forward/)
    const submit = within(dialog).getByRole('button', { name: 'Start New Batch' })

    await userEvent.type(amountInput, '150')
    expect(submit).toBeDisabled()

    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '50')
    expect(submit).toBeEnabled()

    await userEvent.click(submit)
    expect(mockStartNewBatch).toHaveBeenCalledWith('ib1', { name: undefined, goal: undefined, carryForwardMl: 50 })
  })

  it('Delete Infinity Bottle confirm calls deleteInfinityBottle and navigates to Home', async () => {
    render(<BatchManagementPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Infinity Bottle' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Your source bottles in My Bar are not/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Infinity Bottle' }))
    expect(mockDeleteInfinityBottle).toHaveBeenCalledWith('ib1')
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity')
  })
})
