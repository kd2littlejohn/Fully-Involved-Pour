import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { usePourQuickActions } from './usePourQuickActions'
import type { Bottle, InfinityBottle, UserDoc } from '../../data/types'

const mockUseUserData = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../quickPour/QuickPour', () => ({
  QuickPour: ({ bottleName }: { bottleName: string }) => <div>Quick Pour view — {bottleName}</div>,
}))

function TestHarness() {
  const hub = usePourQuickActions()
  return (
    <>
      <button type="button" onClick={hub.open}>
        Open
      </button>
      {hub.modal}
    </>
  )
}

function mockData(overrides: Partial<UserDoc> = {}) {
  mockUseUserData.mockReturnValue({
    userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [], ...overrides },
  })
}

function renderHarness() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TestHarness />} />
        <Route path="/blind/new" element={<div>Create Blind Page</div>} />
        <Route path="/bottles/new" element={<div>Add Bottle Page</div>} />
        <Route path="/bottles/:bottleId/edit" element={<div>Edit Bottle Page</div>} />
        <Route path="/collection/infinity" element={<div>Infinity Bottles Home</div>} />
        <Route path="/collection/infinity/:id/add" element={<div>Add To Blend Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const openBottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }
const sealedBottle: Bottle = { id: 'b2', name: 'Weller 12', status: 'sealed' }

describe('usePourQuickActions', () => {
  it('only offers actions the user can actually perform', async () => {
    mockData({ bottles: [] })
    renderHarness()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.queryByRole('button', { name: /Record a Pour/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Update an Open Bottle/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add to an Infinity Bottle/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start a Blind Tasting/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add a Bottle/ })).toBeInTheDocument()
  })

  it('opens the bottle picker then Quick Pour for Record a Pour', async () => {
    mockData({ bottles: [openBottle, sealedBottle] })
    renderHarness()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.click(screen.getByRole('button', { name: /Record a Pour/ }))

    expect(screen.getByText('Which bottle?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Weller 12/ }))

    expect(screen.getByText('Quick Pour view — Weller 12')).toBeInTheDocument()
  })

  it('navigates to Create Blind for Start a Blind Tasting', async () => {
    mockData()
    renderHarness()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.click(screen.getByRole('button', { name: /Start a Blind Tasting/ }))

    expect(screen.getByText('Create Blind Page')).toBeInTheDocument()
  })

  it('navigates to Add a Bottle', async () => {
    mockData()
    renderHarness()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.click(screen.getByRole('button', { name: /Add a Bottle/ }))

    expect(screen.getByText('Add Bottle Page')).toBeInTheDocument()
  })

  it('picks an open bottle and routes to its edit page for Update an Open Bottle', async () => {
    mockData({ bottles: [openBottle, sealedBottle] })
    renderHarness()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.click(screen.getByRole('button', { name: /Update an Open Bottle/ }))

    expect(screen.getByText('Which bottle?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Weller 12/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Eagle Rare/ }))

    expect(screen.getByText('Edit Bottle Page')).toBeInTheDocument()
  })

  it('routes straight to the add-to-blend page when exactly one Infinity Bottle is active', async () => {
    const infinity: InfinityBottle = {
      id: 'ib1',
      name: 'The House Blend',
      archived: false,
      createdAt: 1,
      batches: [{ id: 'batch1', status: 'active', startedAt: 1, additions: [], tastings: [] }],
    }
    mockData({ infinityBottles: [infinity] })
    renderHarness()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.click(screen.getByRole('button', { name: /Add to an Infinity Bottle/ }))

    expect(screen.getByText('Add To Blend Page')).toBeInTheDocument()
  })

  it('routes to the Infinity Bottles list when more than one is active', async () => {
    const makeIb = (id: string): InfinityBottle => ({
      id,
      name: id,
      archived: false,
      createdAt: 1,
      batches: [{ id: `${id}-batch`, status: 'active', startedAt: 1, additions: [], tastings: [] }],
    })
    mockData({ infinityBottles: [makeIb('ib1'), makeIb('ib2')] })
    renderHarness()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.click(screen.getByRole('button', { name: /Add to an Infinity Bottle/ }))

    expect(screen.getByText('Infinity Bottles Home')).toBeInTheDocument()
  })
})
