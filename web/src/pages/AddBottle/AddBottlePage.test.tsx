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
const mockFindBottleByUpc = vi.fn()
const mockLookupBottleByBarcode = vi.fn()
const mockSaveBottleToCatalog = vi.fn()
let mockBottles: Bottle[] = []

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

const { FakeBarcodeLookupTimeoutError } = vi.hoisted(() => {
  class FakeBarcodeLookupTimeoutError extends Error {}
  return { FakeBarcodeLookupTimeoutError }
})

vi.mock('../../data/repositories/barcode', () => ({
  findBottleByUpc: (...args: unknown[]) => mockFindBottleByUpc(...args),
  lookupBottleByBarcode: (...args: unknown[]) => mockLookupBottleByBarcode(...args),
  saveBottleToCatalog: (...args: unknown[]) => mockSaveBottleToCatalog(...args),
  BarcodeLookupTimeoutError: FakeBarcodeLookupTimeoutError,
}))

vi.mock('../../features/barcodeScan/BarcodeScannerModal', () => ({
  BarcodeScannerModal: ({
    onDetected,
    onManualEntry,
    onClose,
  }: {
    onDetected: (upc: string) => void
    onManualEntry: () => void
    onClose: () => void
  }) => (
    <div>
      <button type="button" onClick={() => onDetected('012345678905')}>
        fake-detect-upc
      </button>
      <button type="button" onClick={onManualEntry}>
        fake-scanner-manual-entry
      </button>
      <button type="button" onClick={onClose}>
        fake-scanner-close
      </button>
    </div>
  ),
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
  OwnershipFieldsCard: ({ values }: { values: { status: string } }) => <div data-testid="fake-status">{values.status}</div>,
}))

function renderPage(initialState?: { defaultStatus?: string; prefill?: { name?: string; distillery?: string; type?: string } }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/bottles/new', state: initialState }]}>
      <AddBottlePage />
    </MemoryRouter>,
  )
}

// A fresh, non-prefilled Add Bottle now opens on the three-way entry
// choice — Manual Entry is the direct equivalent of what these
// form-focused tests used to see immediately.
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
  mockFindBottleByUpc.mockReset()
  mockLookupBottleByBarcode.mockReset()
  mockSaveBottleToCatalog.mockReset().mockResolvedValue(undefined)
  mockBottles = []
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
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

  describe('Scan UPC', () => {
    async function goToScanner() {
      await userEvent.click(await screen.findByRole('button', { name: /^Scan UPC/ }))
    }

    it('resolves a barcode already in the catalog without calling the external lookup', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockFindBottleByUpc.mockResolvedValue({
        found: true,
        upc: '012345678905',
        name: 'Eagle Rare 10 Year',
        distillery: 'Buffalo Trace',
        type: 'Bourbon',
        proof: 90,
        ageStatement: '10 Year',
      })
      renderPage()
      await goToScanner()

      await userEvent.click(screen.getByRole('button', { name: 'fake-detect-upc' }))

      expect(await screen.findByText('Eagle Rare 10 Year')).toBeInTheDocument()
      expect(screen.getByText('Buffalo Trace')).toBeInTheDocument()
      expect(screen.getByText('012345678905')).toBeInTheDocument()
      expect(mockLookupBottleByBarcode).not.toHaveBeenCalled()
    })

    it('falls back to the external lookup when the catalog has no match, then saves the confirmed result back to it', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockFindBottleByUpc.mockResolvedValue(undefined)
      mockLookupBottleByBarcode.mockResolvedValue({
        found: true,
        upc: '012345678905',
        name: 'Stagg Jr.',
        distillery: 'Buffalo Trace',
        proof: 128,
      })
      mockAddBottle.mockResolvedValue('new-id')
      renderPage()
      await goToScanner()
      await userEvent.click(screen.getByRole('button', { name: 'fake-detect-upc' }))
      await screen.findByText('Stagg Jr.')

      await userEvent.click(screen.getByRole('button', { name: /^Add to My Bar/ }))

      expect(mockAddBottle).toHaveBeenCalledWith(expect.objectContaining({ name: 'Stagg Jr.', upc: '012345678905' }))
      await vi.waitFor(() =>
        expect(mockSaveBottleToCatalog).toHaveBeenCalledWith(
          '012345678905',
          expect.objectContaining({ name: 'Stagg Jr.', distillery: 'Buffalo Trace' }),
        ),
      )
      expect(mockNavigate).toHaveBeenCalledWith('/collection/new-id')
    })

    it('notes when the scanned bottle is already in My Bar, without blocking adding another', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockBottles = [{ id: 'existing-1', name: 'My Eagle Rare', status: 'sealed', createdAt: 1, upc: '012345678905' }]
      mockFindBottleByUpc.mockResolvedValue({ found: true, upc: '012345678905', name: 'Eagle Rare 10 Year' })
      renderPage()
      await goToScanner()

      await userEvent.click(screen.getByRole('button', { name: 'fake-detect-upc' }))

      expect(await screen.findByText('Already in My Bar as “My Eagle Rare.”')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Add to My Bar/ })).toBeEnabled()
    })

    it('shows "Edit Details" leading into the existing form, prefilled from the scan', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockFindBottleByUpc.mockResolvedValue({
        found: true,
        upc: '012345678905',
        name: 'Eagle Rare 10 Year',
        distillery: 'Buffalo Trace',
      })
      renderPage()
      await goToScanner()
      await userEvent.click(screen.getByRole('button', { name: 'fake-detect-upc' }))
      await screen.findByText('Eagle Rare 10 Year')

      await userEvent.click(screen.getByRole('button', { name: 'Edit Details' }))

      expect(screen.getByLabelText('Bottle name')).toHaveValue('Eagle Rare 10 Year')
      expect(screen.getByTestId('fake-distillery')).toHaveTextContent('Buffalo Trace')
    })

    it('offers Scan Label with AI and Enter Manually when no match is found anywhere, and still tags the UPC once completed', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockFindBottleByUpc.mockResolvedValue(undefined)
      mockLookupBottleByBarcode.mockResolvedValue({ found: false, upc: '012345678905' })
      mockAddBottle.mockResolvedValue('new-id')
      renderPage()
      await goToScanner()
      await userEvent.click(screen.getByRole('button', { name: 'fake-detect-upc' }))

      expect(await screen.findByText("We couldn't find this bottle yet.")).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /^Enter Bottle Manually/ }))

      await userEvent.type(screen.getByLabelText('Bottle name'), 'New Release')
      await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

      expect(mockAddBottle).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Release', upc: '012345678905' }))
      await vi.waitFor(() =>
        expect(mockSaveBottleToCatalog).toHaveBeenCalledWith('012345678905', expect.objectContaining({ name: 'New Release' })),
      )
    })

    it('shows an offline message and skips both lookups entirely when offline', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
      renderPage()
      await goToScanner()

      await userEvent.click(screen.getByRole('button', { name: 'fake-detect-upc' }))

      expect(await screen.findByText("You're offline.")).toBeInTheDocument()
      expect(mockFindBottleByUpc).not.toHaveBeenCalled()
      expect(mockLookupBottleByBarcode).not.toHaveBeenCalled()
    })

    it('shows a timeout-specific message and manual fallback when the lookup takes too long', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      mockFindBottleByUpc.mockResolvedValue(undefined)
      mockLookupBottleByBarcode.mockRejectedValue(new FakeBarcodeLookupTimeoutError())
      renderPage()
      await goToScanner()

      await userEvent.click(screen.getByRole('button', { name: 'fake-detect-upc' }))

      expect(await screen.findByText('That lookup took too long.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Enter Bottle Manually/ })).toBeInTheDocument()
    })

    it('lets the scanner’s own "Enter Manually" fallback (e.g. camera permission denied) skip straight to the form', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      renderPage()
      await goToScanner()

      await userEvent.click(screen.getByRole('button', { name: 'fake-scanner-manual-entry' }))

      expect(screen.getByLabelText('Bottle name')).toBeInTheDocument()
      expect(mockFindBottleByUpc).not.toHaveBeenCalled()
    })

    it('closing the scanner returns to the three-way choice screen', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      renderPage()
      await goToScanner()

      await userEvent.click(screen.getByRole('button', { name: 'fake-scanner-close' }))

      expect(await screen.findByRole('button', { name: /^Scan UPC/ })).toBeInTheDocument()
    })
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
  })
})
