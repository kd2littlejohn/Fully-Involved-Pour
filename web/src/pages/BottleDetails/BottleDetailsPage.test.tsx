import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BottleDetailsPage } from './BottleDetailsPage'
import type { Bottle, Pour } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../features/faceoff/repository', () => ({
  castFaceoffVote: vi.fn().mockResolvedValue(undefined),
  getFaceoffTally: vi.fn().mockResolvedValue({ votesForA: 0, votesForB: 0 }),
}))

vi.mock('../../data/repositories/blindRoom', () => ({
  getBottleBlindHistory: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../data/repositories/fipGuide', () => ({
  getFipGuide: vi.fn().mockResolvedValue(undefined),
}))

function renderPage(bottleId: string) {
  return render(
    <MemoryRouter initialEntries={[`/collection/${bottleId}`]}>
      <Routes>
        <Route path="/collection/:bottleId" element={<BottleDetailsPage />} />
        <Route path="/bottles/:bottleId/edit" element={<div>Edit Bottle Page</div>} />
        <Route path="/bottles/new" element={<div>Add Bottle Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openBottleMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Bottle actions' }))
}

const eagleRare: Bottle = {
  id: 'b1',
  name: 'Eagle Rare',
  distillery: 'Buffalo Trace',
  status: 'open',
  proof: 90,
  createdAt: new Date('2026-01-01').getTime(),
  openedDate: '2026-02-01',
}

const wellerSpecial: Bottle = {
  id: 'b2',
  name: 'Weller Special Reserve',
  distillery: 'Buffalo Trace',
  status: 'sealed',
  proof: 90,
  createdAt: new Date('2026-01-05').getTime(),
}

const pour: Pour = {
  id: 'p1',
  bottleId: 'b1',
  date: '2026-03-01',
  rating: 8.2,
  occasion: 'Porch time',
  fip: { nose: 2, palate: 3, finish: 1.6, complexity: 0.8, value: 0.8, total: 8.2, noseAromas: [], palateFlavors: [] },
}

const mockDeleteBottle = vi.fn().mockResolvedValue(undefined)
const mockUpdateBottle = vi.fn().mockResolvedValue(undefined)

function mockSignedInWith(bottles: Bottle[], pours: Pour[] = []) {
  mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [], people: [] },
    loading: false,
    signedIn: true,
    addBottle: vi.fn(),
    updateBottle: mockUpdateBottle,
    deleteBottle: mockDeleteBottle,
  })
}

describe('BottleDetailsPage', () => {
  it('shows a not-found state for an unknown bottle id', () => {
    mockSignedInWith([eagleRare])
    renderPage('does-not-exist')
    expect(screen.getByText("We couldn't find this bottle.")).toBeInTheDocument()
  })

  it('renders the Overview tab by default with bottle details', () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')
    expect(screen.getByRole('heading', { name: 'Eagle Rare' })).toBeInTheDocument()
    expect(screen.getAllByText('90').length).toBeGreaterThan(0)
  })

  it('switches to the Pour Stories tab and shows real pours', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Pour Stories' }))
    expect(screen.getByText('Porch time', { exact: false })).toBeInTheDocument()
  })

  it('orders Journey events chronologically from real fields', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Journey' }))
    const panel = screen.getByRole('tabpanel')
    const labels = within(panel)
      .getAllByText(/Added to your bar|Opened|Pour —/)
      .map((el) => el.textContent)
    expect(labels).toEqual(['Added to your bar', 'Opened', 'Pour — 8.2'])
  })

  it('opens a Pour Story quick view when a Journey pour event is clicked', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Journey' }))
    await userEvent.click(screen.getByRole('button', { name: /Pour — 8\.2/ }))

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(within(dialog).getByRole('heading', { name: 'Eagle Rare' })).toBeInTheDocument()
  })

  it('does not make lifecycle events like "Added to your bar" clickable', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Journey' }))

    expect(screen.queryByRole('button', { name: /Added to your bar/ })).not.toBeInTheDocument()
  })

  it('requires confirmation before deleting, then calls deleteBottle', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await openBottleMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete Bottle' }))
    expect(screen.getByText('Delete this bottle?')).toBeInTheDocument()
    expect(mockDeleteBottle).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))
    expect(mockDeleteBottle).toHaveBeenCalledWith('b1')
  })

  it('navigates to the edit route when Edit Bottle is picked from the menu', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await openBottleMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit Bottle' }))

    expect(screen.getByText('Edit Bottle Page')).toBeInTheDocument()
  })

  it('navigates to Add Bottle, prefilled, when Replace Bottle is picked from the menu', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await openBottleMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Replace Bottle' }))

    expect(screen.getByText('Add Bottle Page')).toBeInTheDocument()
  })

  it('toggles favorite status from the menu', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await openBottleMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add to Favorites' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { favorite: true })
  })

  it('offers a Remove from Favorites label once a bottle is already a favorite', async () => {
    mockSignedInWith([{ ...eagleRare, favorite: true }], [pour])
    renderPage('b1')

    await openBottleMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from Favorites' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { favorite: false })
  })

  it('does not offer Change Status in the menu — the status pill itself is the shortcut', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await openBottleMenu()
    expect(screen.queryByRole('menuitem', { name: 'Change Status' })).not.toBeInTheDocument()
  })

  it('changes a sealed bottle to Opened in one tap, without going through Edit', async () => {
    mockSignedInWith([wellerSpecial], [])
    renderPage('b2')

    await userEvent.click(screen.getByRole('button', { name: 'Sealed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Opened' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b2', { status: 'open', openedDate: expect.any(String) })
  })

  it('shows the bottle’s current status as disabled and already marked "Current" in the picker', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await userEvent.click(screen.getByRole('button', { name: 'Opened' }))

    const current = screen.getByText('Current').closest('button')
    expect(current).toHaveTextContent('Opened')
    expect(current).toBeDisabled()
  })

  it('changes an open bottle to Finished, sets a finishedDate, and celebrates', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await userEvent.click(screen.getByRole('button', { name: 'Opened' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finished' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { status: 'finished', finishedDate: expect.any(String) })
    expect(screen.getByText('🥃 Bottle Kill')).toBeInTheDocument()
    expect(screen.getByText(/You finished Eagle Rare after 1 pour/)).toBeInTheDocument()
  })

  it('does not celebrate when changing status to anything other than Finished', async () => {
    mockSignedInWith([wellerSpecial], [])
    renderPage('b2')

    await userEvent.click(screen.getByRole('button', { name: 'Sealed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Opened' }))

    expect(screen.queryByText('🥃 Bottle Kill')).not.toBeInTheDocument()
  })

  it('opens a photo quick view when the bottle image is clicked', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await userEvent.click(screen.getByRole('button', { name: 'View photo' }))

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(within(dialog).getByText('Add Photo')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument()
  })

  it('shows Replace Photo instead of Add Photo when the bottle already has an image', async () => {
    mockSignedInWith([{ ...eagleRare, imageUrl: 'https://example.com/eagle-rare.jpg' }], [pour])
    renderPage('b1')

    await userEvent.click(screen.getByRole('button', { name: 'View photo' }))

    expect(within(screen.getByRole('dialog', { hidden: true })).getByText('Replace Photo')).toBeInTheDocument()
  })

  it('toggles favorite status from the hero pill directly, not just the overflow menu', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await userEvent.click(screen.getByRole('button', { name: '☆ Favorite' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { favorite: true })
  })

  it('shows the hero favorite pill as active once the bottle is a favorite', () => {
    mockSignedInWith([{ ...eagleRare, favorite: true }], [pour])
    renderPage('b1')

    expect(screen.getByRole('button', { name: '★ Favorite' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('resolves a known distillery to its real city/state for the hero location line', () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    expect(screen.getByText('Buffalo Trace · Frankfort, Kentucky')).toBeInTheDocument()
  })

  it('shows the fill level as a percentage next to the status pill', () => {
    mockSignedInWith([{ ...eagleRare, fillLevel: 'three-quarter' }], [pour])
    renderPage('b1')

    expect(screen.getByText('75% Full')).toBeInTheDocument()
  })

  it('shows core facts as Proof (with its ABV equivalent), Age Statement, and Bottle Size', () => {
    mockSignedInWith([{ ...eagleRare, ageStatement: '10 Year', bottleSize: 750 }], [pour])
    renderPage('b1')

    // "Proof" and "Bottle Size" are real labels in both the core-facts row
    // and the canonical Bottle Info list below — just confirming the ABV
    // sublabel (unique to the core-facts tile) is enough to prove the tile
    // itself rendered correctly.
    expect(screen.getAllByText('Proof').length).toBeGreaterThan(0)
    expect(screen.getByText('45% ABV')).toBeInTheDocument()
    expect(screen.getByText('Age Statement')).toBeInTheDocument()
    expect(screen.getAllByText('Bottle Size').length).toBeGreaterThan(0)
    expect(screen.getAllByText('750ml').length).toBeGreaterThan(0)
  })

  it('shows a type badge and the FIP tier name next to the score', () => {
    mockSignedInWith([{ ...eagleRare, type: 'Bourbon' }], [pour])
    renderPage('b1')

    expect(screen.getAllByText('Bourbon').length).toBeGreaterThan(0)
    // Eagle Rare's only pour rates 8.2 -> Working Fire tier.
    expect(screen.getByText('Working Fire')).toBeInTheDocument()
  })

  it('offers Start a Pour as a prominent, always-visible primary action', () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    expect(screen.getByRole('button', { name: 'Start a Pour' })).toBeInTheDocument()
  })

  it('opens the pour-type chooser, defaulting straight to this bottle, when Start a Pour is tapped', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour' }))

    expect(screen.getByText('Pouring Eagle Rare')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quick Pour/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pour Story/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Compare/ })).toBeInTheDocument()
  })

  it('initializes the Compare tab from location.state.initialTab (Compare routing target)', () => {
    mockSignedInWith([eagleRare, wellerSpecial], [pour])
    render(
      <MemoryRouter initialEntries={[{ pathname: '/collection/b1', state: { initialTab: 'compare' } }]}>
        <Routes>
          <Route path="/collection/:bottleId" element={<BottleDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('tab', { name: 'Compare', selected: true })).toBeInTheDocument()
  })

  it('renders the Your Take card with the current score', () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    expect(screen.getByText('Your Take')).toBeInTheDocument()
    expect(screen.getAllByText('8.2').length).toBeGreaterThan(0)
  })

  it('saves a Your Take pick directly to the bottle', async () => {
    mockSignedInWith([eagleRare], [pour])
    renderPage('b1')

    await userEvent.click(screen.getByRole('button', { name: 'Absolutely' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { buyAgain: 'absolutely' })
  })

  it('compares two bottles side by side once one is selected', async () => {
    mockSignedInWith([eagleRare, wellerSpecial], [pour])
    renderPage('b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Compare' }))
    await userEvent.selectOptions(screen.getByLabelText('Compare with'), 'b2')
    expect(screen.getByRole('columnheader', { name: 'Weller Special Reserve' })).toBeInTheDocument()
    expect(screen.getAllByText('8.2').length).toBeGreaterThan(0)
  })
})
