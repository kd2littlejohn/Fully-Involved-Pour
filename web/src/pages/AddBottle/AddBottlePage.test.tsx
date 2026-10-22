import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddBottlePage } from './AddBottlePage'
import type { Bottle } from '../../data/types'

const mockUseAuth = vi.fn()
const mockSaveBarcodeEntry = vi.fn()
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

vi.mock('../../data/repositories/barcode', () => ({
  saveBarcodeEntry: (...args: unknown[]) => mockSaveBarcodeEntry(...args),
}))

// The real scanner needs a camera; this stand-in hands back what the flow
// would after the user picked a release.
const SCANNED = {
  bottle: {
    name: 'Example Barrel Proof',
    distillery: 'Example Distillery',
    brand: null,
    expression: null,
    category: 'Bourbon',
    sizeMl: 750,
    proof: null,
    proofVaries: true,
    ageStatement: '12 Year',
    releaseKind: 'barrel-proof-batch',
    batch: 'C924',
    barrel: null,
    storePick: null,
    releaseYear: null,
  },
  gtin13: '0036000291452',
  printedBarcode: '036000291452',
  origin: 'verified',
  candidateId: 'c924',
  submitForReview: false,
}

vi.mock('../../features/barcode/ScanBarcodeFlow', () => ({
  ScanBarcodeFlow: ({
    onUse,
    onUpdatedExisting,
    onCancel,
  }: {
    onUse: (handoff: unknown) => void
    onUpdatedExisting: (id: string) => void
    onCancel: () => void
  }) => (
    <div>
      <p>fake-scanner</p>
      <button type="button" onClick={() => onUse({ ...SCANNED, status: 'sealed' })}>
        fake-add-to-bar
      </button>
      <button type="button" onClick={() => onUse({ ...SCANNED, status: 'wishlist' })}>
        fake-add-to-wishlist
      </button>
      <button type="button" onClick={() => onUpdatedExisting('existing-1')}>
        fake-increased
      </button>
      <button type="button" onClick={onCancel}>
        fake-cancel
      </button>
    </div>
  ),
}))

vi.mock('../../data/repositories/rarity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/rarity')>()
  return { ...actual, requestRaritySuggestion: vi.fn().mockResolvedValue({ status: 'failed' }) }
})

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
  mockSaveBarcodeEntry.mockReset()
  mockSaveBarcodeEntry.mockResolvedValue('entry-1')
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

  it('a failed rarity suggestion never blocks saving the bottle', async () => {
    const { requestRaritySuggestion } = await import('../../data/repositories/rarity')
    vi.mocked(requestRaritySuggestion).mockResolvedValue({ status: 'failed' })
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockResolvedValue('new-bottle-id')
    // Prefilled distillery/type gives the real RarityFieldsCard enough
    // identity to auto-request immediately, without needing to interact
    // with the mocked-out EssentialFieldsCard stub.
    renderPage({ prefill: { name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', type: 'Bourbon' } })

    await screen.findByText("We couldn't suggest a rarity for this bottle.")

    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(mockAddBottle).toHaveBeenCalled()
    const [payload] = mockAddBottle.mock.calls[0]!
    expect(payload.rarity).toBeUndefined()
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

  describe('Scan Barcode', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    })

    it('is the first option when adding a bottle', async () => {
      renderPage()
      const options = await screen.findAllByRole('button')
      expect(options[options.findIndex((b) => /Scan Label with AI/.test(b.textContent ?? '')) - 1]).toHaveTextContent('Scan Barcode')
    })

    it('fills the form from the scanned bottle and saves its barcode, then remembers it privately', async () => {
      mockAddBottle.mockResolvedValue('new-1')
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: /^Scan Barcode/ }))
      await userEvent.click(await screen.findByRole('button', { name: 'fake-add-to-bar' }))
      expect(screen.getByLabelText('Bottle name')).toHaveValue('Example Barrel Proof — Batch C924')
      expect(screen.getByTestId('fake-distillery')).toHaveTextContent('Example Distillery')
      expect(screen.getByText(/From barcode 036000291452, adding to My Bar/)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))
      expect(mockAddBottle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Example Barrel Proof — Batch C924',
          distillery: 'Example Distillery',
          type: 'Bourbon',
          bottleSize: 750,
          ageStatement: '12 Year',
          status: 'sealed',
          upc: '036000291452',
        }),
      )
      // A barrel-proof release with no proof on the label is saved without one.
      expect(mockAddBottle.mock.calls[0]?.[0].proof).toBeUndefined()
      expect(mockSaveBarcodeEntry).toHaveBeenCalledWith('user-1', expect.objectContaining({ gtin13: '0036000291452', bottleId: 'new-1', candidateId: 'c924', origin: 'verified' }))
      expect(mockNavigate).toHaveBeenCalledWith('/collection/new-1')
    })

    it('adds to the Wishlist when that was chosen in the scanner', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: /^Scan Barcode/ }))
      await userEvent.click(await screen.findByRole('button', { name: 'fake-add-to-wishlist' }))
      expect(screen.getByTestId('fake-status')).toHaveTextContent('wishlist')
      expect(screen.getByText(/adding to your Wishlist/)).toBeInTheDocument()
    })

    it('still saves the bottle when remembering the barcode fails', async () => {
      mockAddBottle.mockResolvedValue('new-2')
      mockSaveBarcodeEntry.mockRejectedValue(new Error('permission-denied'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: /^Scan Barcode/ }))
      await userEvent.click(await screen.findByRole('button', { name: 'fake-add-to-bar' }))
      await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))
      expect(mockNavigate).toHaveBeenCalledWith('/collection/new-2')
      warn.mockRestore()
    })

    it('goes to the existing bottle after Increase quantity in the scanner', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: /^Scan Barcode/ }))
      await userEvent.click(await screen.findByRole('button', { name: 'fake-increased' }))
      expect(mockNavigate).toHaveBeenCalledWith('/collection/existing-1')
      expect(mockAddBottle).not.toHaveBeenCalled()
    })

    it('Cancel returns to the add options', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: /^Scan Barcode/ }))
      await userEvent.click(await screen.findByRole('button', { name: 'fake-cancel' }))
      expect(await screen.findByRole('button', { name: /^Manual Entry/ })).toBeInTheDocument()
    })

    it('a manual add without scanning never sets upc or remembers a barcode', async () => {
      mockAddBottle.mockResolvedValue('new-3')
      renderPage()
      await goToManualEntry()
      await userEvent.type(screen.getByLabelText('Bottle name'), 'Typed Bottle')
      await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))
      expect(mockAddBottle.mock.calls[0]?.[0]).not.toHaveProperty('upc')
      expect(mockSaveBarcodeEntry).not.toHaveBeenCalled()
    })
  })
})
