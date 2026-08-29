import { render, screen, within } from '@testing-library/react'
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

const mockAddBlendAdditions = vi.fn().mockResolvedValue(undefined)
let mockBottles: Bottle[] = []
let mockInfinityBottles: InfinityBottle[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: mockBottles, pours: [], memories: [], infinityBottles: mockInfinityBottles, customLibrary: [], people: [] },
    addBlendAdditions: mockAddBlendAdditions,
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

async function selectBottle(name: string) {
  await userEvent.click(screen.getByText(name).closest('button')!)
}

async function continueToAmounts() {
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

// bottleName div -> bottleInfo -> amountCardHeader -> amountCard
function amountCard(bottleName: string) {
  return screen.getByText(bottleName).closest('div')!.parentElement!.parentElement!.parentElement!
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockAddBlendAdditions.mockClear()
  mockInfinityBottles = [ib()]
  mockBottles = [
    bottle({ id: 'b1', name: 'Eagle Rare', proof: 90, bottleSize: 750, fillLevel: 'half' }),
    bottle({ id: 'b2', name: 'Weller 107', proof: 107, bottleSize: 750 }),
    bottle({ id: 'b3', name: "Blanton's", proof: 93 }),
    bottle({ id: 'b4', name: 'Old Grand-Dad 114', proof: 114 }),
    bottle({ id: 'b5', name: 'Buffalo Trace', proof: 90 }),
    bottle({ id: 'b6', name: 'Sealed Bottle', proof: 90, status: 'sealed' }),
  ]
})

describe('AddToBlendPage — guards', () => {
  it('shows an empty state when the Infinity Bottle cannot be found', () => {
    mockInfinityBottles = []
    render(<AddToBlendPage />)
    expect(screen.getByText("We couldn't find that Infinity Bottle.")).toBeInTheDocument()
  })

  it('shows an empty state for an archived Infinity Bottle instead of the select flow', () => {
    mockInfinityBottles = [ib({ archived: true })]
    render(<AddToBlendPage />)
    expect(screen.getByText('This Infinity Bottle is archived.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Search your bottles')).not.toBeInTheDocument()
  })

  it('resolves the Infinity Bottle by route id among several — never falls back to whichever is first', async () => {
    mockInfinityBottles = [
      ib({ id: 'ib-a', name: 'Not This One', batches: [{ id: 'batch-a', status: 'active', startedAt: 1, additions: [], tastings: [] }] }),
      ib({ id: 'ib1', name: 'Backdraft Batch', batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] }),
      ib({ id: 'ib-c', name: 'Also Not This One', batches: [{ id: 'batch-c', status: 'active', startedAt: 1, additions: [], tastings: [] }] }),
    ]
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await continueToAmounts()
    await userEvent.click(screen.getByRole('button', { name: '60ml' }))
    await userEvent.click(screen.getByRole('button', { name: /Add 1 Bottle to Blend/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Add 1 Bottle to Blend/ }))

    expect(mockAddBlendAdditions).toHaveBeenCalledWith('ib1', 'b1', expect.any(Array))
  })
})

describe('AddToBlendPage — selection (Step 1)', () => {
  it('only lists open bottles and filters by search, preserving existing selections', async () => {
    render(<AddToBlendPage />)
    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Sealed Bottle')).not.toBeInTheDocument()

    await selectBottle('Eagle Rare')
    await userEvent.type(screen.getByLabelText('Search your bottles'), 'weller')
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument()
    expect(screen.getByText('Weller 107')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Search your bottles'))
    expect(screen.getByText('1 Selected')).toBeInTheDocument()
  })

  it('selecting 2 bottles shows "2 Selected" and both continue through to Step 2', async () => {
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await selectBottle('Weller 107')
    expect(screen.getByText('2 Selected')).toBeInTheDocument()

    await continueToAmounts()
    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.getByText('Weller 107')).toBeInTheDocument()
  })

  it('selecting 5 bottles shows "5 Selected" and all 5 carry through to Step 2', async () => {
    render(<AddToBlendPage />)
    for (const name of ['Eagle Rare', 'Weller 107', "Blanton's", 'Old Grand-Dad 114', 'Buffalo Trace']) {
      await selectBottle(name)
    }
    expect(screen.getByText('5 Selected')).toBeInTheDocument()

    await continueToAmounts()
    for (const name of ['Eagle Rare', 'Weller 107', "Blanton's", 'Old Grand-Dad 114', 'Buffalo Trace']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('selecting the same bottle twice toggles it off (prevents duplicate selection)', async () => {
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    expect(screen.getByText('1 Selected')).toBeInTheDocument()
    await selectBottle('Eagle Rare')
    expect(screen.queryByText('1 Selected')).not.toBeInTheDocument()
    expect(screen.queryByText(/Selected/)).not.toBeInTheDocument()
  })

  it('deselecting one of several bottles removes only that one', async () => {
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await selectBottle('Weller 107')
    await selectBottle('Eagle Rare')
    expect(screen.getByText('1 Selected')).toBeInTheDocument()

    await continueToAmounts()
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument()
    expect(screen.getByText('Weller 107')).toBeInTheDocument()
  })

  it('Clear empties the selection', async () => {
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await selectBottle('Weller 107')
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByText(/Selected/)).not.toBeInTheDocument()
  })
})

describe('AddToBlendPage — amounts (Step 2)', () => {
  async function selectTwoAndContinue() {
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await selectBottle('Weller 107')
    await continueToAmounts()
  }

  it('"Back to Bottles" returns to Step 1 without losing the selection', async () => {
    await selectTwoAndContinue()
    await userEvent.click(screen.getByRole('button', { name: '‹ Back to Bottles' }))
    expect(screen.getByText('2 Selected')).toBeInTheDocument()
  })

  it('a deselected bottle can be removed with its own "×" control on Step 2', async () => {
    await selectTwoAndContinue()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Eagle Rare' }))
    expect(screen.queryByText('Eagle Rare')).not.toBeInTheDocument()
    expect(screen.getByText('Weller 107')).toBeInTheDocument()
  })

  it('quick chips set that bottle’s amount only, and different bottles can get different amounts', async () => {
    await selectTwoAndContinue()
    const eagleCard = amountCard('Eagle Rare')
    const wellerCard = amountCard('Weller 107')

    await userEvent.click(within(eagleCard).getByRole('button', { name: '60ml' }))
    await userEvent.click(within(wellerCard).getByRole('button', { name: '30ml' }))

    expect(within(eagleCard).getByLabelText('Amount (ml)')).toHaveValue(60)
    expect(within(wellerCard).getByLabelText('Amount (ml)')).toHaveValue(30)
  })

  it('120ml is available as a quick chip alongside the smaller amounts', async () => {
    await selectTwoAndContinue()
    const eagleCard = amountCard('Eagle Rare')
    expect(within(eagleCard).getByRole('button', { name: '120ml' })).toBeInTheDocument()
  })

  it('each bottle gets its own independent note', async () => {
    await selectTwoAndContinue()
    const eagleCard = amountCard('Eagle Rare')
    const wellerCard = amountCard('Weller 107')

    await userEvent.type(within(eagleCard).getByLabelText('Why are you adding this? (optional)'), 'Add sweetness and proof')
    await userEvent.type(within(wellerCard).getByLabelText('Why are you adding this? (optional)'), 'Softening it out')

    expect(within(eagleCard).getByLabelText('Why are you adding this? (optional)')).toHaveValue('Add sweetness and proof')
    expect(within(wellerCard).getByLabelText('Why are you adding this? (optional)')).toHaveValue('Softening it out')
  })

  it('"Apply to All" sets every selected bottle to the same amount', async () => {
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await selectBottle('Weller 107')
    await selectBottle("Blanton's")
    await continueToAmounts()

    await userEvent.type(screen.getByLabelText('Apply same amount to all (ml)'), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Apply to All' }))

    for (const name of ['Eagle Rare', 'Weller 107', "Blanton's"]) {
      expect(within(amountCard(name)).getByLabelText('Amount (ml)')).toHaveValue(30)
    }
  })

  it('the running total updates as amounts are set', async () => {
    await selectTwoAndContinue()
    await userEvent.click(within(amountCard('Eagle Rare')).getByRole('button', { name: '60ml' }))
    await userEvent.click(within(amountCard('Weller 107')).getByRole('button', { name: '30ml' }))
    expect(screen.getByText('Adding').nextElementSibling).toHaveTextContent('90ml')
  })

  it('switching units preserves the underlying ml value without cumulative rounding drift', async () => {
    await selectTwoAndContinue()
    const eagleCard = amountCard('Eagle Rare')
    await userEvent.click(within(eagleCard).getByRole('button', { name: '60ml' }))

    await userEvent.click(screen.getByRole('button', { name: 'oz' }))
    expect(within(eagleCard).getByLabelText('Amount (oz)')).toHaveValue(Math.round((60 / 29.5735) * 100) / 100)

    await userEvent.click(screen.getByRole('button', { name: 'ml' }))
    // Round-tripping ml -> oz -> ml lands back on exactly 60, not a
    // drifted value like 59 or 61 from repeated display-string rounding.
    expect(within(eagleCard).getByLabelText('Amount (ml)')).toHaveValue(60)
  })

  it('disables the CTA until every selected bottle has a positive amount', async () => {
    await selectTwoAndContinue()
    expect(screen.getByRole('button', { name: /Add 2 Bottles to Blend/ })).toBeDisabled()

    await userEvent.click(within(amountCard('Eagle Rare')).getByRole('button', { name: '60ml' }))
    expect(screen.getByRole('button', { name: /Add 2 Bottles to Blend/ })).toBeDisabled()

    await userEvent.click(within(amountCard('Weller 107')).getByRole('button', { name: '30ml' }))
    expect(screen.getByRole('button', { name: /Add 2 Bottles to Blend/ })).toBeEnabled()
  })

  it('capacity validation blocks the CTA with the exact overage and total-capacity message', async () => {
    mockInfinityBottles = [
      ib({
        capacityMl: 1000,
        batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [{ id: 'a1', bottleName: 'Existing', amountMl: 860, date: '2026-01-01', createdAt: 1 }], tastings: [] }],
      }),
    ]
    await selectTwoAndContinue()
    await userEvent.click(within(amountCard('Eagle Rare')).getByRole('button', { name: '90ml' }))
    await userEvent.click(within(amountCard('Weller 107')).getByRole('button', { name: '60ml' }))

    // 860 existing + 90 + 60 = 1010 — 10ml over the 1000ml capacity.
    expect(screen.getByText('This would exceed your 1000ml capacity by 10ml.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add 2 Bottles to Blend/ })).toBeDisabled()

    // Adjusting amounts back down (860 + 90 + 15 = 965) clears the error and re-enables the CTA.
    await userEvent.click(within(amountCard('Weller 107')).getByRole('button', { name: '15ml' }))
    expect(screen.queryByText(/This would exceed/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add 2 Bottles to Blend/ })).toBeEnabled()
  })
})

describe('AddToBlendPage — review and save', () => {
  async function getToReview() {
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await selectBottle('Weller 107')
    await continueToAmounts()
    await userEvent.click(within(amountCard('Eagle Rare')).getByRole('button', { name: '60ml' }))
    await userEvent.click(within(amountCard('Weller 107')).getByRole('button', { name: '30ml' }))
    await userEvent.click(screen.getByRole('button', { name: /Add 2 Bottles to Blend/ }))
  }

  it('shows a compact review summary with per-bottle amounts and totals', async () => {
    await getToReview()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Add to Backdraft Batch?')).toBeInTheDocument()
    expect(within(dialog).getByText('Eagle Rare')).toBeInTheDocument()
    expect(within(dialog).getByText('60ml')).toBeInTheDocument()
    expect(within(dialog).getByText('Weller 107')).toBeInTheDocument()
    expect(within(dialog).getByText('30ml')).toBeInTheDocument()
    expect(within(dialog).getByText('Total').nextElementSibling).toHaveTextContent('90ml')
  })

  it('shows current → new estimated proof only when both are available', async () => {
    mockInfinityBottles = [
      ib({
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [{ id: 'a1', bottleName: 'Existing', amountMl: 40, proof: 100, date: '2026-01-01', createdAt: 1 }],
            tastings: [],
          },
        ],
      }),
    ]
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await selectBottle('Weller 107')
    await continueToAmounts()
    await userEvent.click(within(amountCard('Eagle Rare')).getByRole('button', { name: '60ml' }))
    await userEvent.click(within(amountCard('Weller 107')).getByRole('button', { name: '30ml' }))
    await userEvent.click(screen.getByRole('button', { name: /Add 2 Bottles to Blend/ }))

    // Current: 40ml @ 100 proof = 100.0. New: (40*100 + 60*90 + 30*107) / 130 = 97.0.
    expect(screen.getByText('100.0 → 97.0')).toBeInTheDocument()
  })

  it('does not show a current → new pairing when the existing batch has no additions yet — shows Unavailable instead', async () => {
    await getToReview()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Unavailable')).toBeInTheDocument()
  })

  it('shows "Unavailable" instead of a proof estimate when any contributing bottle lacks proof', async () => {
    mockBottles = mockBottles.map((b) => (b.name === 'Weller 107' ? { ...b, proof: undefined } : b))
    await getToReview()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Unavailable')).toBeInTheDocument()
  })

  it('confirming saves both additions in one call, never two separate calls', async () => {
    await getToReview()
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Add 2 Bottles to Blend/ }))

    expect(mockAddBlendAdditions).toHaveBeenCalledTimes(1)
    expect(mockAddBlendAdditions).toHaveBeenCalledWith(
      'ib1',
      'b1',
      expect.arrayContaining([
        expect.objectContaining({ sourceBottleId: 'b1', bottleName: 'Eagle Rare', proof: 90, amountMl: 60 }),
        expect.objectContaining({ sourceBottleId: 'b2', bottleName: 'Weller 107', proof: 107, amountMl: 30 }),
      ]),
    )
    const [, , inputs] = mockAddBlendAdditions.mock.calls[0]!
    expect(inputs).toHaveLength(2)
  })

  it('shows a success confirmation, and Done navigates to Blend Breakdown', async () => {
    await getToReview()
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Add 2 Bottles to Blend/ }))

    expect(await screen.findByText('2 Bottles added to Backdraft Batch.')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity/ib1')
  })

  it('a failed save shows a retryable error and keeps every selection intact — nothing is saved', async () => {
    mockAddBlendAdditions.mockRejectedValueOnce(new Error('offline'))
    await getToReview()
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Add 2 Bottles to Blend/ }))

    expect(await screen.findByText('Could not save these additions. Try again.')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    // Still showing the review with both bottles — nothing was cleared.
    expect(within(dialog).getByText('Eagle Rare')).toBeInTheDocument()
    expect(within(dialog).getByText('Weller 107')).toBeInTheDocument()
  })

  it('Cancel closes the review without saving, keeping Step 2 amounts intact', async () => {
    await getToReview()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockAddBlendAdditions).not.toHaveBeenCalled()
    expect(within(amountCard('Eagle Rare')).getByLabelText('Amount (ml)')).toHaveValue(60)
  })
})

describe('AddToBlendPage — multiple physical bottles of the same source', () => {
  it('a bottle with exactly one open instance resolves silently — no picker, saved with that instance id', async () => {
    mockBottles = [
      bottle({
        id: 'b1',
        name: 'Eagle Rare',
        proof: 90,
        instances: [
          { id: 'i1', status: 'open', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 2 },
        ],
      }),
    ]
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await continueToAmounts()

    expect(screen.queryByLabelText('Which bottle?')).not.toBeInTheDocument()

    await userEvent.click(within(amountCard('Eagle Rare')).getByRole('button', { name: '60ml' }))
    await userEvent.click(screen.getByRole('button', { name: /Add 1 Bottle to Blend/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Add 1 Bottle to Blend/ }))

    expect(mockAddBlendAdditions).toHaveBeenCalledWith('ib1', 'b1', [expect.objectContaining({ sourceBottleInstanceId: 'i1' })])
  })

  it('a bottle with two open instances requires picking one before Review, and shows it in the review line', async () => {
    mockBottles = [
      bottle({
        id: 'b1',
        name: 'Eagle Rare',
        proof: 90,
        instances: [
          { id: 'i1', status: 'open', createdAt: 1 },
          { id: 'i2', status: 'open', createdAt: 2, label: 'Total Wine' },
        ],
      }),
    ]
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await continueToAmounts()

    const card = amountCard('Eagle Rare')
    await userEvent.click(within(card).getByRole('button', { name: '60ml' }))
    expect(screen.getByRole('button', { name: /Add 1 Bottle to Blend/ })).toBeDisabled()

    await userEvent.selectOptions(within(card).getByLabelText('Which bottle?'), 'i2')
    expect(screen.getByRole('button', { name: /Add 1 Bottle to Blend/ })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: /Add 1 Bottle to Blend/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Eagle Rare · Bottle #2 — Total Wine')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /Add 1 Bottle to Blend/ }))
    expect(mockAddBlendAdditions).toHaveBeenCalledWith('ib1', 'b1', [expect.objectContaining({ sourceBottleInstanceId: 'i2' })])
  })

  it('a plain bottle with no instances never shows the picker and saves with no sourceBottleInstanceId', async () => {
    render(<AddToBlendPage />)
    await selectBottle('Eagle Rare')
    await continueToAmounts()
    expect(screen.queryByLabelText('Which bottle?')).not.toBeInTheDocument()

    await userEvent.click(within(amountCard('Eagle Rare')).getByRole('button', { name: '60ml' }))
    await userEvent.click(screen.getByRole('button', { name: /Add 1 Bottle to Blend/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Add 1 Bottle to Blend/ }))

    expect(mockAddBlendAdditions).toHaveBeenCalledWith('ib1', 'b1', [expect.objectContaining({ sourceBottleInstanceId: undefined })])
  })
})
