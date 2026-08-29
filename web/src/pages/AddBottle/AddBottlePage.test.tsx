import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddBottlePage } from './AddBottlePage'
import type { Bottle } from '../../data/types'

const mockUseAuth = vi.fn()
const mockAddBottle = vi.fn()
const mockUpdateBottle = vi.fn()
const mockNavigate = vi.fn()
let mockBottles: Bottle[] = []

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: mockBottles },
    loading: false,
    addBottle: mockAddBottle,
    updateBottle: mockUpdateBottle,
  }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('./BottlePhotoHero', () => ({
  BottlePhotoHero: ({
    onImageChange,
    onScanResult,
  }: {
    onImageChange: (change: { imageUrl: string | undefined; originalImageUrl?: string; imageProcessingStatus?: string }) => void
    onScanResult: (info: { name?: string; distillery?: string }) => void
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onImageChange({
            imageUrl: 'https://example.com/bottle-fip.jpg',
            originalImageUrl: 'https://example.com/bottle-original.jpg',
            imageProcessingStatus: 'ready',
          })
        }
      >
        fake-set-image
      </button>
      <button type="button" onClick={() => onScanResult({ name: 'Scanned Bottle', distillery: 'Scanned Distillery' })}>
        fake-scan
      </button>
    </div>
  ),
}))

vi.mock('./EssentialFieldsCard', () => ({
  EssentialFieldsCard: ({
    values,
    onChange,
    nameError,
  }: {
    values: { name: string; distillery: string }
    onChange: (patch: Record<string, string>) => void
    nameError?: string
  }) => (
    <div>
      <label htmlFor="fake-name">Bottle name</label>
      <input id="fake-name" value={values.name} onChange={(e) => onChange({ name: e.target.value })} />
      <span data-testid="fake-distillery">{values.distillery}</span>
      {nameError ? <p role="alert">{nameError}</p> : null}
    </div>
  ),
}))

vi.mock('./OwnershipFieldsCard', () => ({
  OwnershipFieldsCard: ({
    values,
    onChange,
    multiInstance,
  }: {
    values: { status: string; quantity: string; price: string; storeLocation: string }
    onChange: (patch: Record<string, string>) => void
    multiInstance?: boolean
  }) => (
    <div>
      <span data-testid="fake-status">{values.status}</span>
      <span data-testid="fake-multi-instance">{String(!!multiInstance)}</span>
      <label htmlFor="fake-quantity">Quantity</label>
      <input id="fake-quantity" value={values.quantity} onChange={(e) => onChange({ quantity: e.target.value })} />
      <label htmlFor="fake-price">Price</label>
      <input id="fake-price" value={values.price} onChange={(e) => onChange({ price: e.target.value })} />
      <label htmlFor="fake-store">Store</label>
      <input id="fake-store" value={values.storeLocation} onChange={(e) => onChange({ storeLocation: e.target.value })} />
    </div>
  ),
}))

vi.mock('./BottleInstancesCard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./BottleInstancesCard')>()
  return {
    ...actual,
    BottleInstancesCard: ({
      drafts,
      onDraftsChange,
    }: {
      drafts: { id: string; price: string }[]
      onDraftsChange: (drafts: { id: string; price: string }[]) => void
    }) => (
      <div data-testid="fake-instances-card">
        <span data-testid="fake-draft-count">{drafts.length}</span>
        {drafts.map((draft, i) => (
          <button
            key={draft.id}
            type="button"
            onClick={() => onDraftsChange(drafts.map((d, ii) => (ii === i ? { ...d, price: '10' } : d)))}
          >
            fill-draft-{i}
          </button>
        ))}
      </div>
    ),
  }
})

function renderPage(initialState?: { defaultStatus?: string; prefill?: { name?: string; distillery?: string; type?: string } }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/bottles/new', state: initialState }]}>
      <AddBottlePage />
    </MemoryRouter>,
  )
}

// A fresh, non-prefilled Add Bottle now opens on the entry choice screen
// (Scan Label with AI / Manual Entry) — Manual Entry is the direct
// equivalent of what these form-focused tests used to see immediately.
async function goToManualEntry() {
  await userEvent.click(await screen.findByRole('button', { name: /^Manual Entry/ }))
}

function renderEditPage(bottleId: string) {
  return render(
    <MemoryRouter initialEntries={[`/bottles/${bottleId}/edit`]}>
      <Routes>
        <Route path="/bottles/:bottleId/edit" element={<AddBottlePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockAddBottle.mockReset()
  mockUpdateBottle.mockReset()
  mockNavigate.mockReset()
  mockBottles = []
})

describe('AddBottlePage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderPage()

    expect(screen.getByText('Sign in to continue.')).toBeInTheDocument()
  })

  it('defaults status from location state (e.g. wishlist entry point)', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    renderPage({ defaultStatus: 'wishlist' })
    await goToManualEntry()

    expect(screen.getByTestId('fake-status')).toHaveTextContent('wishlist')
  })

  it('prefills essential fields from location state (e.g. an AI recommendation)', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    renderPage({ defaultStatus: 'wishlist', prefill: { name: 'Redbreast 12', distillery: 'Midleton', type: 'Irish' } })

    expect(screen.getByLabelText('Bottle name')).toHaveValue('Redbreast 12')
    expect(screen.getByTestId('fake-distillery')).toHaveTextContent('Midleton')
  })

  it('requires a bottle name before submitting', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    renderPage()
    await goToManualEntry()

    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Bottle name is required.')
    expect(mockAddBottle).not.toHaveBeenCalled()
  })

  it('merges scan results into empty fields without overwriting user input', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    renderPage()
    await goToManualEntry()

    await userEvent.click(screen.getByRole('button', { name: 'fake-scan' }))

    expect(screen.getByTestId('fake-distillery')).toHaveTextContent('Scanned Distillery')
    expect(screen.getByLabelText('Bottle name')).toHaveValue('Scanned Bottle')
  })

  it('submits the bottle and navigates to its detail page on success', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockResolvedValue('new-bottle-id')
    renderPage()
    await goToManualEntry()

    await userEvent.type(screen.getByLabelText('Bottle name'), "Blanton's")
    await userEvent.click(screen.getByRole('button', { name: 'fake-set-image' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(mockAddBottle).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Blanton's",
        imageUrl: 'https://example.com/bottle-fip.jpg',
        originalImageUrl: 'https://example.com/bottle-original.jpg',
        imageProcessingStatus: 'ready',
        status: 'sealed',
      }),
    )
    expect(mockNavigate).toHaveBeenCalledWith('/collection/new-bottle-id')
  })

  it('a quantity of 1 never shows "Your Bottles" and saves with no instances field at all', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockResolvedValue('new-bottle-id')
    renderPage()
    await goToManualEntry()

    await userEvent.type(screen.getByLabelText('Bottle name'), 'Eagle Rare')
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(screen.queryByTestId('fake-instances-card')).not.toBeInTheDocument()
    const [payload] = mockAddBottle.mock.calls[0]!
    expect(payload.instances).toBeUndefined()
    expect(payload.activeInstanceId).toBeUndefined()
  })

  it('raising quantity to 3 reveals two draft bottles', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    renderPage()
    await goToManualEntry()

    expect(screen.queryByTestId('fake-instances-card')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Quantity'), '3')

    expect(screen.getByTestId('fake-draft-count')).toHaveTextContent('2')
  })

  it('quantity 1 -> 3: Bottle 1 inherits the already-entered price/store, the other two are sealed with no price', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockResolvedValue('new-bottle-id')
    renderPage()
    await goToManualEntry()

    await userEvent.type(screen.getByLabelText('Bottle name'), 'Eagle Rare')
    await userEvent.type(screen.getByLabelText('Price'), '39.99')
    await userEvent.type(screen.getByLabelText('Store'), 'ABC Store')
    await userEvent.type(screen.getByLabelText('Quantity'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    const [payload] = mockAddBottle.mock.calls[0]!
    expect(payload.instances).toHaveLength(3)
    expect(payload.instances[0]).toMatchObject({ price: 39.99, storeLocation: 'ABC Store', status: 'sealed' })
    expect(payload.instances[1]).toMatchObject({ status: 'sealed', price: undefined })
    expect(payload.instances[2]).toMatchObject({ status: 'sealed', price: undefined })
    // Top-level fields roll up from the instances, kept in sync for old readers.
    expect(payload.quantity).toBe(3)
    expect(payload.price).toBe(39.99)
  })

  it('quantity 1 -> 3 on a bottle that starts Opened: only Bottle 1 opens, the rest stay Sealed', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockResolvedValue('new-bottle-id')
    renderPage({ defaultStatus: 'open' })
    await goToManualEntry()

    await userEvent.type(screen.getByLabelText('Bottle name'), 'Eagle Rare')
    await userEvent.type(screen.getByLabelText('Quantity'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    const [payload] = mockAddBottle.mock.calls[0]!
    expect(payload.instances[0].status).toBe('open')
    expect(payload.instances[1].status).toBe('sealed')
    expect(payload.status).toBe('open')
  })

  it('a filled-in draft bottle’s details make it into the saved instances array', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockResolvedValue('new-bottle-id')
    renderPage()
    await goToManualEntry()

    await userEvent.type(screen.getByLabelText('Bottle name'), 'Eagle Rare')
    await userEvent.type(screen.getByLabelText('Quantity'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'fill-draft-0' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    const [payload] = mockAddBottle.mock.calls[0]!
    expect(payload.instances[1].price).toBe(10)
  })

  it('dropping quantity back to 1 hides "Your Bottles" again', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    renderPage()
    await goToManualEntry()

    await userEvent.type(screen.getByLabelText('Quantity'), '3')
    expect(screen.getByTestId('fake-instances-card')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Quantity'))
    await userEvent.type(screen.getByLabelText('Quantity'), '1')
    expect(screen.queryByTestId('fake-instances-card')).not.toBeInTheDocument()
  })

  it('shows the error and preserves form state when saving fails', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockRejectedValue(new Error('The image uploaded, but the bottle could not be saved.'))
    renderPage()
    await goToManualEntry()

    await userEvent.type(screen.getByLabelText('Bottle name'), "Blanton's")
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(await screen.findByText('The image uploaded, but the bottle could not be saved.')).toBeInTheDocument()
    expect(screen.getByLabelText('Bottle name')).toHaveValue("Blanton's")
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  describe('editing an existing bottle', () => {
    const existingBottle: Bottle = {
      id: 'b1',
      name: 'Eagle Rare 10 Year',
      distillery: 'Buffalo Trace',
      status: 'sealed',
      createdAt: 1,
    }

    it('shows a not-found state for an unknown bottle id', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockBottles = []
      renderEditPage('does-not-exist')

      expect(screen.getByText("We couldn't find this bottle.")).toBeInTheDocument()
    })

    it('hydrates the form from the existing bottle and titles the page Edit Bottle', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockBottles = [existingBottle]
      renderEditPage('b1')

      expect(screen.getByRole('heading', { name: 'Edit Bottle' })).toBeInTheDocument()
      expect(screen.getByLabelText('Bottle name')).toHaveValue('Eagle Rare 10 Year')
      expect(screen.getByTestId('fake-distillery')).toHaveTextContent('Buffalo Trace')
      expect(screen.getByTestId('fake-status')).toHaveTextContent('sealed')
    })

    it('saves changes via updateBottle and navigates back to the bottle', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockBottles = [existingBottle]
      renderEditPage('b1')

      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(mockUpdateBottle).toHaveBeenCalledWith('b1', expect.objectContaining({ name: 'Eagle Rare 10 Year' }))
      expect(mockNavigate).toHaveBeenCalledWith('/collection/b1')
      expect(mockAddBottle).not.toHaveBeenCalled()
    })

    it('editing a bottle that already has multiple instances passes multiInstance to Ownership and never shows "Your Bottles"', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockBottles = [
        {
          ...existingBottle,
          status: 'open',
          quantity: 2,
          instances: [
            { id: 'i1', status: 'open', createdAt: 1 },
            { id: 'i2', status: 'sealed', createdAt: 2 },
          ],
          activeInstanceId: 'i1',
        },
      ]
      renderEditPage('b1')

      expect(screen.getByTestId('fake-multi-instance')).toHaveTextContent('true')
      expect(screen.queryByTestId('fake-instances-card')).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      const [, payload] = mockUpdateBottle.mock.calls[0]!
      // Only the required rollup field is sent — instance-owned facts are
      // never touched by this form once instances already exist.
      expect(payload.instances).toBeUndefined()
      expect(payload.price).toBeUndefined()
      expect(payload.storeLocation).toBeUndefined()
      expect(payload.purchaseDate).toBeUndefined()
      expect(payload.status).toBe('open')
    })
  })
})
