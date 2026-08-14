import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BottleCard } from './BottleCard'
import type { Bottle } from '../../data/types'

const mockUseUserData = vi.fn()
const mockUpdateBottle = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../features/quickPour/QuickPour', () => ({
  QuickPour: ({ bottleName }: { bottleName: string }) => <div>Quick Pour view — {bottleName}</div>,
}))

vi.mock('../../features/pourWizard/PourWizard', () => ({
  PourWizard: ({ bottleName }: { bottleName: string }) => <div>Pour Wizard view — {bottleName}</div>,
}))

function mockData(bottles: Bottle[]) {
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] },
    updateBottle: mockUpdateBottle,
  })
}

function renderCard(bottle: Bottle, props: Partial<{ selectable: boolean; selected: boolean; onToggleSelect: () => void }> = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<BottleCard bottle={bottle} {...props} />} />
        <Route path="/bottles/:bottleId/edit" element={<div>Edit Bottle Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openMenu(bottleName: string) {
  await userEvent.click(screen.getByRole('button', { name: `${bottleName} actions` }))
}

const eagleRare: Bottle = { id: 'b1', name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', status: 'open', rating: 9.2 }

describe('BottleCard', () => {
  beforeEach(() => {
    mockUpdateBottle.mockClear()
  })

  it('links the card body to the bottle details route', () => {
    mockData([eagleRare])
    renderCard(eagleRare)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/collection/b1')
  })

  it('splits a dash-separated name into title and subtitle', () => {
    mockData([eagleRare])
    renderCard({ ...eagleRare, name: 'Elijah Craig Small Batch - 2026 PGA Championship Edition' })
    expect(screen.getByText('Elijah Craig Small Batch')).toBeInTheDocument()
    expect(screen.getByText('2026 PGA Championship Edition')).toBeInTheDocument()
  })

  it('shows an ordinary name whole when there is no separator', () => {
    mockData([eagleRare])
    renderCard(eagleRare)
    expect(screen.getByText('Eagle Rare 10 Year')).toBeInTheDocument()
  })

  it('offers a contextual menu instead of a row of visible action buttons', () => {
    mockData([eagleRare])
    renderCard(eagleRare)
    expect(screen.getByRole('button', { name: 'Eagle Rare 10 Year actions' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start a Pour' })).not.toBeInTheDocument()
  })

  it('opens the pour-type chooser from the menu', async () => {
    mockData([eagleRare])
    renderCard(eagleRare)

    await openMenu('Eagle Rare 10 Year')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Start a Pour' }))

    expect(screen.getByText('Pouring Eagle Rare 10 Year')).toBeInTheDocument()
  })

  it('does not offer Start a Pour for a wishlist bottle', async () => {
    const wishlist: Bottle = { id: 'b2', name: 'Pappy 15', status: 'wishlist' }
    mockData([wishlist])
    renderCard(wishlist)

    await openMenu('Pappy 15')
    expect(screen.queryByRole('menuitem', { name: 'Start a Pour' })).not.toBeInTheDocument()
  })

  it('toggles favorite status from the menu', async () => {
    mockData([eagleRare])
    renderCard(eagleRare)

    await openMenu('Eagle Rare 10 Year')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add to Favorites' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { favorite: true })
  })

  it('offers Mark Finished only for an open bottle', async () => {
    const sealed: Bottle = { id: 'b3', name: 'Weller 12', status: 'sealed' }
    mockData([sealed])
    renderCard(sealed)

    await openMenu('Weller 12')
    expect(screen.queryByRole('menuitem', { name: 'Mark Finished' })).not.toBeInTheDocument()
  })

  it('marks an open bottle finished from the menu', async () => {
    mockData([eagleRare])
    renderCard(eagleRare)

    await openMenu('Eagle Rare 10 Year')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mark Finished' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { status: 'finished', finishedDate: expect.any(String) })
  })

  it('navigates to the edit route from the menu', async () => {
    mockData([eagleRare])
    renderCard(eagleRare)

    await openMenu('Eagle Rare 10 Year')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))

    expect(screen.getByText('Edit Bottle Page')).toBeInTheDocument()
  })

  it('renders as a selection checkbox instead of a link when selectable', async () => {
    mockData([eagleRare])
    const onToggleSelect = vi.fn()
    renderCard(eagleRare, { selectable: true, onToggleSelect })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eagle Rare 10 Year actions' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleSelect).toHaveBeenCalled()
  })
})
