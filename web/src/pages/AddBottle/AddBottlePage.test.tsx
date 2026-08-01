import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddBottlePage } from './AddBottlePage'

const mockUseAuth = vi.fn()
const mockAddBottle = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ addBottle: mockAddBottle }),
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
    onImageChange: (url: string | undefined) => void
    onScanResult: (info: { name?: string; distillery?: string }) => void
  }) => (
    <div>
      <button type="button" onClick={() => onImageChange('https://example.com/bottle.jpg')}>
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

beforeEach(() => {
  mockAddBottle.mockReset()
  mockNavigate.mockReset()
})

describe('AddBottlePage', () => {
  it('shows a sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderPage()

    expect(screen.getByText('Sign in to continue.')).toBeInTheDocument()
  })

  it('defaults status from location state (e.g. wishlist entry point)', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    renderPage({ defaultStatus: 'wishlist' })

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

    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Bottle name is required.')
    expect(mockAddBottle).not.toHaveBeenCalled()
  })

  it('merges scan results into empty fields without overwriting user input', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'fake-scan' }))

    expect(screen.getByTestId('fake-distillery')).toHaveTextContent('Scanned Distillery')
    expect(screen.getByLabelText('Bottle name')).toHaveValue('Scanned Bottle')
  })

  it('submits the bottle and navigates to its detail page on success', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockResolvedValue('new-bottle-id')
    renderPage()

    await userEvent.type(screen.getByLabelText('Bottle name'), "Blanton's")
    await userEvent.click(screen.getByRole('button', { name: 'fake-set-image' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(mockAddBottle).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Blanton's", imageUrl: 'https://example.com/bottle.jpg', status: 'sealed' }),
    )
    expect(mockNavigate).toHaveBeenCalledWith('/collection/new-bottle-id')
  })

  it('shows the error and preserves form state when saving fails', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockAddBottle.mockRejectedValue(new Error('The image uploaded, but the bottle could not be saved.'))
    renderPage()

    await userEvent.type(screen.getByLabelText('Bottle name'), "Blanton's")
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(await screen.findByText('The image uploaded, but the bottle could not be saved.')).toBeInTheDocument()
    expect(screen.getByLabelText('Bottle name')).toHaveValue("Blanton's")
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
