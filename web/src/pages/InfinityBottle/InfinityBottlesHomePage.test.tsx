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
const mockArchiveInfinityBottle = vi.fn().mockResolvedValue(undefined)
const mockDeleteInfinityBottle = vi.fn().mockResolvedValue(undefined)
let mockInfinityBottles: InfinityBottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: [], pours: [], memories: [], infinityBottles: mockInfinityBottles, customLibrary: [], people: [] },
    createInfinityBottle: mockCreateInfinityBottle,
    archiveInfinityBottle: mockArchiveInfinityBottle,
    deleteInfinityBottle: mockDeleteInfinityBottle,
  }),
}))

beforeEach(() => {
  mockNavigate.mockClear()
  mockCreateInfinityBottle.mockClear()
  mockArchiveInfinityBottle.mockClear()
  mockDeleteInfinityBottle.mockClear()
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

async function openMenu(cardName: string) {
  await userEvent.click(screen.getByRole('button', { name: `${cardName} actions` }))
}

describe('InfinityBottlesHomePage — empty states', () => {
  it('shows "Create Your First Infinity Bottle." when there are no Infinity Bottles at all', async () => {
    render(<InfinityBottlesHomePage />)
    expect(screen.getByText('Create Your First Infinity Bottle.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Create Infinity Bottle' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Backdraft Batch')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Infinity Bottle' }))

    expect(mockCreateInfinityBottle).toHaveBeenCalledWith({ name: 'Backdraft Batch', capacityMl: undefined })
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/new-ib-id')
  })

  it('shows "No active Infinity Bottles." with a create action when every bottle is archived', () => {
    mockInfinityBottles = [activeBatch({ archived: true })]
    render(<InfinityBottlesHomePage />)
    expect(screen.getByText('No active Infinity Bottles.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create New Infinity Bottle' })).toBeInTheDocument()
  })

  it('shows "No archived Infinity Bottles." on the Archived tab when nothing is archived', async () => {
    mockInfinityBottles = [activeBatch()]
    render(<InfinityBottlesHomePage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Archived' }))
    expect(screen.getByText('No archived Infinity Bottles.')).toBeInTheDocument()
  })

  it('"+ New Infinity Bottle" stays available even when active Infinity Bottles already exist', () => {
    mockInfinityBottles = [activeBatch()]
    render(<InfinityBottlesHomePage />)
    expect(screen.getByRole('button', { name: '+ New Infinity Bottle' })).toBeEnabled()
  })
})

describe('InfinityBottlesHomePage — a single active card', () => {
  it('shows volume/capacity, fill %, proof, score, source count, and last-activity dates', () => {
    mockInfinityBottles = [activeBatch()]
    render(<InfinityBottlesHomePage />)

    expect(screen.getByText('Backdraft Batch - First Due')).toBeInTheDocument()
    expect(screen.getByText('Current Batch')).toBeInTheDocument()
    expect(screen.getByText('400ml / 1000ml')).toBeInTheDocument()
    expect(screen.getByText('40% full')).toBeInTheDocument()
    expect(screen.getByText('90.0')).toBeInTheDocument()
    expect(screen.getByText('8.5 ★')).toBeInTheDocument()
    expect(screen.getByText('1 source bottles')).toBeInTheDocument()
    expect(screen.getByText(/Last addition/)).toBeInTheDocument()
    expect(screen.getByText(/Last tasting/)).toBeInTheDocument()
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

  it('the "Manage" overflow action navigates to Batch Management for that Infinity Bottle', async () => {
    mockInfinityBottles = [activeBatch()]
    render(<InfinityBottlesHomePage />)
    await openMenu('Backdraft Batch - First Due')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Manage' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1/manage')
  })

  it('Add to Blend, Log a Tasting, and View Blend all route by this card’s own id', async () => {
    mockInfinityBottles = [activeBatch()]
    render(<InfinityBottlesHomePage />)

    await userEvent.click(screen.getByRole('button', { name: 'Add to Blend' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1/add')

    await userEvent.click(screen.getByRole('button', { name: 'Log a Tasting' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1/tastings/new')

    await userEvent.click(screen.getByRole('button', { name: 'View Blend' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1')
  })
})

describe('InfinityBottlesHomePage — multiple simultaneous active Infinity Bottles', () => {
  function threeActiveBottles(): InfinityBottle[] {
    return [
      activeBatch({ id: 'ib1', name: 'Backdraft Batch', capacityMl: 1000 }),
      activeBatch({
        id: 'ib2',
        name: 'House Blend #1',
        capacityMl: 750,
        batches: [
          {
            id: 'b2',
            name: 'Batch 1',
            status: 'active',
            startedAt: 1,
            additions: [{ id: 'a2', bottleName: 'Weller 12', amountMl: 480, proof: 90, date: '2026-01-01', createdAt: 1 }],
            tastings: [],
          },
        ],
      }),
      activeBatch({
        id: 'ib3',
        name: 'Rye Project',
        capacityMl: 750,
        batches: [
          {
            id: 'b3',
            name: 'Batch 1',
            status: 'active',
            startedAt: 1,
            additions: [{ id: 'a3', bottleName: 'Rittenhouse', amountMl: 220, proof: 100, date: '2026-01-01', createdAt: 1 }],
            tastings: [],
          },
        ],
      }),
    ]
  }

  it('renders all three as equal, full-width cards under Active — none hidden, none "featured"', () => {
    mockInfinityBottles = threeActiveBottles()
    render(<InfinityBottlesHomePage />)

    expect(screen.getByText('Backdraft Batch - First Due')).toBeInTheDocument()
    expect(screen.getByText('House Blend #1 - Batch 1')).toBeInTheDocument()
    expect(screen.getByText('Rye Project - Batch 1')).toBeInTheDocument()

    // Every card gets the full action row — not just a stripped-down
    // secondary card for anything past the first.
    expect(screen.getAllByRole('button', { name: 'Add to Blend' })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'View Blend' })).toHaveLength(3)
  })

  it('never labels the 2nd/3rd bottle as "Other Infinity Bottles" or "Other Bottles"', () => {
    mockInfinityBottles = threeActiveBottles()
    render(<InfinityBottlesHomePage />)
    expect(screen.queryByText('Other Infinity Bottles')).not.toBeInTheDocument()
    expect(screen.queryByText('Other Bottles')).not.toBeInTheDocument()
  })

  it('each card shows its own independently computed volume, proof, and composition', () => {
    mockInfinityBottles = threeActiveBottles()
    render(<InfinityBottlesHomePage />)

    expect(screen.getByText('400ml / 1000ml')).toBeInTheDocument()
    expect(screen.getByText('480ml / 750ml')).toBeInTheDocument()
    expect(screen.getByText('220ml / 750ml')).toBeInTheDocument()
    // 90.0 proof appears on both Backdraft Batch and House Blend #1.
    expect(screen.getAllByText('90.0')).toHaveLength(2)
    expect(screen.getByText('100.0')).toBeInTheDocument()
  })

  it('View Blend on the third card navigates using that card’s own id, not the first one’s', async () => {
    mockInfinityBottles = threeActiveBottles()
    render(<InfinityBottlesHomePage />)

    const ryeCard = screen.getByText('Rye Project - Batch 1').closest('div')!.parentElement!
    await userEvent.click(within(ryeCard).getByRole('button', { name: 'View Blend' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib3')
  })
})

describe('InfinityBottlesHomePage — Archived tab', () => {
  it('shows only archived Infinity Bottles, leaving active ones out', async () => {
    mockInfinityBottles = [activeBatch(), activeBatch({ id: 'ib2', name: 'Retired Blend', archived: true })]
    render(<InfinityBottlesHomePage />)

    await userEvent.click(screen.getByRole('tab', { name: 'Archived' }))

    expect(screen.queryByText('Backdraft Batch - First Due')).not.toBeInTheDocument()
    expect(screen.getByText('Retired Blend - First Due')).toBeInTheDocument()
  })

  it('Unarchive calls archiveInfinityBottle(id, false) and does not touch any other bottle', async () => {
    mockInfinityBottles = [activeBatch(), activeBatch({ id: 'ib2', name: 'Retired Blend', archived: true })]
    render(<InfinityBottlesHomePage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Archived' }))

    await openMenu('Retired Blend - First Due')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Unarchive' }))

    expect(mockArchiveInfinityBottle).toHaveBeenCalledWith('ib2', false)
    expect(mockArchiveInfinityBottle).toHaveBeenCalledTimes(1)
  })

  it('Delete requires confirmation, then calls deleteInfinityBottle with only that id', async () => {
    mockInfinityBottles = [activeBatch(), activeBatch({ id: 'ib2', name: 'Retired Blend', archived: true })]
    render(<InfinityBottlesHomePage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Archived' }))

    await openMenu('Retired Blend - First Due')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Your source bottles in My Bar are not/)).toBeInTheDocument()
    expect(mockDeleteInfinityBottle).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Infinity Bottle' }))
    expect(mockDeleteInfinityBottle).toHaveBeenCalledWith('ib2')
    expect(mockDeleteInfinityBottle).toHaveBeenCalledTimes(1)
  })

  it('View History (tapping the card body) navigates to that archived bottle’s Blend Breakdown', async () => {
    mockInfinityBottles = [activeBatch({ id: 'ib2', name: 'Retired Blend', archived: true })]
    render(<InfinityBottlesHomePage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Archived' }))

    await openMenu('Retired Blend - First Due')
    await userEvent.click(screen.getByRole('menuitem', { name: 'View History' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib2')
  })
})

describe('InfinityBottlesHomePage — legacy-data resilience', () => {
  // Regression test for the production crash this page's rendering used to
  // throw ("undefined is not an object (evaluating 'e.batches.length')")
  // when a record still had the legacy flat-additions shape and no
  // `batches` at all. useUserData normalizes on load in the real app, but
  // this asserts the page itself is defense-in-depth safe even if a record
  // somehow reaches it un-normalized.
  it('does not crash when an Infinity Bottle record has no batches array at all (legacy shape)', () => {
    mockInfinityBottles = [
      { id: 'legacy-1', name: 'Old Blend', additions: [{ name: 'Eagle Rare', amount: '2 oz' }] } as unknown as InfinityBottle,
    ]
    expect(() => render(<InfinityBottlesHomePage />)).not.toThrow()
  })
})
