import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CollectionPage } from '../../pages/Collection/CollectionPage'
import {
  DEFAULT_INVENTORY_VIEW,
  inventorySearchString,
  parseInventoryView,
  readSavedInventory,
  useInventoryReturnPath,
} from './inventoryViewState'
import type { Bottle } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open', distillery: 'Buffalo Trace', createdAt: 1 },
  { id: 'b2', name: 'Weller 12', status: 'sealed', distillery: 'Buffalo Trace', createdAt: 2 },
  { id: 'b3', name: 'Weller Special Reserve', status: 'open', distillery: 'Buffalo Trace', createdAt: 3 },
  { id: 'b4', name: 'Rittenhouse Rye', status: 'open', distillery: 'Heaven Hill', createdAt: 4 },
]

// Stand-in for Bottle Details: the same "Back to My Bar" path the real page
// uses (useInventoryReturnPath), plus the browser's own Back.
function DetailsStub() {
  const { bottleId } = useParams()
  const navigate = useNavigate()
  return (
    <div>
      <p>Details for {bottleId}</p>
      <Link to={useInventoryReturnPath()}>Back to My Bar</Link>
      <button type="button" onClick={() => navigate(-1)}>
        browser back
      </button>
      <Link to="/collection">nav: My Bar</Link>
    </div>
  )
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="url">{location.pathname + location.search}</output>
}

function renderApp(initialEntries: string[] = ['/collection']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/collection/:bottleId" element={<DetailsStub />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

const searchBox = () => screen.getByLabelText('Search your bar') as HTMLInputElement
const listed = (name: string) => screen.queryAllByText(name).length > 0

async function openBottle(id: string) {
  const link = screen.getAllByRole('link').find((a) => a.getAttribute('href') === `/collection/${id}`)
  if (!link) throw new Error(`no link to bottle ${id}`)
  await userEvent.click(link)
  expect(screen.getByText(`Details for ${id}`)).toBeInTheDocument()
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
    loading: false,
    signedIn: true,
    deleteBottles: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('My Bar keeps its view across bottle details', () => {
  it('keeps the search after opening a bottle and using "Back to My Bar"', async () => {
    renderApp()
    await userEvent.type(searchBox(), 'weller')
    expect(screen.getByTestId('url')).toHaveTextContent('/collection?q=weller')
    expect(listed('Eagle Rare')).toBe(false)

    await openBottle('b2')
    await userEvent.click(screen.getByRole('link', { name: 'Back to My Bar' }))

    expect(searchBox().value).toBe('weller')
    expect(listed('Weller 12')).toBe(true)
    expect(listed('Weller Special Reserve')).toBe(true)
    expect(listed('Eagle Rare')).toBe(false)
    expect(listed('Rittenhouse Rye')).toBe(false)
  })

  it('keeps search, sort and view mode after the browser Back gesture too', async () => {
    renderApp()
    await userEvent.type(searchBox(), 'weller')
    await userEvent.selectOptions(screen.getByLabelText('Sort bottles'), 'name-desc')
    await userEvent.click(screen.getByRole('button', { name: 'List view' }))

    await openBottle('b3')
    await userEvent.click(screen.getByRole('button', { name: 'browser back' }))

    expect(searchBox().value).toBe('weller')
    expect((screen.getByLabelText('Sort bottles') as HTMLSelectElement).value).toBe('name-desc')
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('url')).toHaveTextContent('/collection?q=weller&sort=name-desc&view=list')
  })

  it('keeps filters when returning, and when moving between bottles first', async () => {
    renderApp(['/collection?filter=open'])
    expect(listed('Weller 12')).toBe(false) // sealed

    await openBottle('b3')
    // Wander to another bottle before going back to the list.
    await userEvent.click(screen.getByRole('link', { name: 'Back to My Bar' }))
    await openBottle('b4')
    await userEvent.click(screen.getByRole('link', { name: 'Back to My Bar' }))

    expect(screen.getByTestId('url')).toHaveTextContent('/collection?filter=open')
    expect(listed('Rittenhouse Rye')).toBe(true)
    expect(listed('Weller 12')).toBe(false)
  })

  it('restores the last view when My Bar is opened from the nav (no URL params)', async () => {
    renderApp()
    await userEvent.type(searchBox(), 'rye')
    await openBottle('b4')
    await userEvent.click(screen.getByRole('link', { name: 'nav: My Bar' }))

    expect(searchBox().value).toBe('rye')
    expect(screen.getByTestId('url')).toHaveTextContent('/collection?q=rye')
  })

  // Regression: useAuth starts every mount as { user: null, loading: true }.
  // Restoring must wait for it, and must not overwrite the saved view with
  // defaults in the meantime (found in a real browser, not jsdom).
  it('restores the saved view even when auth is still loading as My Bar mounts', async () => {
    const { rerender } = renderApp()
    await userEvent.type(searchBox(), 'rye')
    await openBottle('b4')

    mockUseAuth.mockReturnValue({ user: null, loading: true })
    await userEvent.click(screen.getByRole('link', { name: 'nav: My Bar' }))
    expect(readSavedInventory('u1')?.search).toBe('?q=rye') // untouched while loading

    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    rerender(
      <MemoryRouter initialEntries={['/collection']}>
        <Routes>
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/collection/:bottleId" element={<DetailsStub />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    )
    expect(await screen.findByDisplayValue('rye')).toBe(searchBox())
    expect(screen.getByTestId('url')).toHaveTextContent('/collection?q=rye')
  })

  it('clearing the search brings back the whole bar, and it stays cleared after a round trip', async () => {
    renderApp()
    await userEvent.type(searchBox(), 'weller')
    await userEvent.clear(searchBox())
    for (const b of bottles) expect(listed(b.name)).toBe(true)
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/collection$/)

    await openBottle('b1')
    await userEvent.click(screen.getByRole('link', { name: 'Back to My Bar' }))
    expect(searchBox().value).toBe('')
    for (const b of bottles) expect(listed(b.name)).toBe(true)
  })

  it('survives a refresh: the view comes back from the URL', () => {
    const { unmount } = renderApp(['/collection?q=weller&view=list'])
    unmount()
    sessionStorage.clear() // a refresh in a brand-new tab, with only the URL
    renderApp(['/collection?q=weller&view=list'])
    expect(searchBox().value).toBe('weller')
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true')
  })

  it("an explicit deep link (Home's ?filter=open View All) wins over the saved view", async () => {
    const first = renderApp()
    await userEvent.type(searchBox(), 'weller')
    first.unmount()

    renderApp(['/collection?filter=open'])
    expect(searchBox().value).toBe('')
    expect(listed('Eagle Rare')).toBe(true)
    expect(listed('Weller 12')).toBe(false)
  })

  it("never restores another account's saved view", async () => {
    const first = renderApp()
    await userEvent.type(searchBox(), 'weller')
    first.unmount()

    mockUseAuth.mockReturnValue({ user: { uid: 'someone-else' }, loading: false })
    renderApp()
    expect(searchBox().value).toBe('')
    expect(readSavedInventory('someone-else')?.search ?? '').toBe('')
  })

  it('returns the user to their scroll position in the list', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)

    renderApp()
    await userEvent.type(searchBox(), 'buffalo')
    Object.defineProperty(window, 'scrollY', { value: 840, configurable: true })
    fireEvent.scroll(window)
    expect(readSavedInventory('u1')).toEqual({ search: '?q=buffalo', scrollY: 840 })

    await openBottle('b2')
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    scrollTo.mockClear()
    await userEvent.click(screen.getByRole('link', { name: 'Back to My Bar' }))

    expect(scrollTo).toHaveBeenCalledWith(0, 840)
  })
})

describe('inventory view URL format', () => {
  it('round-trips a full view and drops defaults', () => {
    const view = { query: 'weller 12', filter: 'open' as const, rarity: 'rare' as const, sort: 'name-asc' as const, view: 'list' as const }
    const search = inventorySearchString(view)
    expect(search).toBe('?q=weller+12&filter=open&rarity=rare&sort=name-asc&view=list')
    expect(parseInventoryView(new URLSearchParams(search))).toEqual(view)
    expect(inventorySearchString(DEFAULT_INVENTORY_VIEW)).toBe('')
  })

  it('ignores unknown or hand-edited values instead of breaking the page', () => {
    expect(parseInventoryView(new URLSearchParams('filter=nope&rarity=mythic&sort=random&view=table'))).toEqual(DEFAULT_INVENTORY_VIEW)
  })
})
