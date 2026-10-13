import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bottle, Pour } from '../../data/types'
import { reconcileInsights } from './engine'

// The Home AXE Insight card end to end on the client: cached rendering,
// no regeneration on mount/remount, AI wording upgrade, freshness labels,
// the backend being unavailable, the expanded evidence view, and Ask AXE
// through the existing chat. The backend is mocked at the Firebase layer.

const mockCall = vi.fn()
const mockAskSommelier = vi.fn()
vi.mock('firebase/functions', () => ({ httpsCallable: () => (data: unknown) => mockCall(data) }))
vi.mock('../../data/firebase', () => ({ db: {}, functions: {} }))
vi.mock('../../data/devMode', () => ({ isMockAuthEnabled: () => false }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, loading: false }) }))
vi.mock('../../data/repositories/ai', () => ({ askSommelier: (...args: unknown[]) => mockAskSommelier(...args) }))

const fip = (r: number) => ({ nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 0.8, total: r, noseAromas: [], palateFlavors: [] })
const bottles: Bottle[] = [
  { id: 'r1', name: 'Rittenhouse', status: 'open', type: 'Rye', proof: 100, createdAt: 1 },
  { id: 'r2', name: 'Pikesville', status: 'open', type: 'Rye', proof: 110, createdAt: 1 },
  { id: 'bb', name: 'Maker’s Mark', status: 'open', type: 'Bourbon', proof: 90, createdAt: 1 },
]
const pours: Pour[] = [
  { id: 'x1', bottleId: 'r1', date: '2026-01-01', rating: 9, fip: fip(9) },
  { id: 'x2', bottleId: 'r2', date: '2026-01-02', rating: 9, fip: fip(9) },
  { id: 'x3', bottleId: 'r1', date: '2026-01-03', rating: 9, fip: fip(9) },
  { id: 'x4', bottleId: 'bb', date: '2026-01-04', rating: 7, fip: fip(7) },
  { id: 'x5', bottleId: 'bb', date: '2026-01-05', rating: 7.4, fip: fip(7.4) },
]

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles, pours, memories: [], infinityBottles: [], customLibrary: [], people: [] } }),
}))

// What the server would have stored for this data (same engine).
function serverView(p: Pour[] = pours, calculatedAt = Date.now()) {
  const { state } = reconcileInsights(null, { bottles, pours: p, today: '2026-10-12' }, { now: calculatedAt, sourceRevision: '1' })
  return {
    status: 'ready',
    generation: 1,
    calculatedAt,
    inputFingerprints: state.inputFingerprints,
    selected: state.selected!.candidate,
    selectedFingerprint: state.selected!.fingerprint,
  }
}

const AI = {
  headline: 'Rye keeps earning your best scores.',
  body: 'Your 3 Rye pours average 9.0, a step above the 7.2 you give everything else.',
  factKeys: ['style', 'styleAverage'],
  actionId: 'open-palate',
}

async function renderCard(p: Pour[] = pours) {
  vi.resetModules()
  const { AxeInsightCard } = await import('./AxeInsightCard')
  const { SommelierProvider } = await import('../sommelier/SommelierProvider')
  return render(
    <SommelierProvider>
      <MemoryRouter>
        <AxeInsightCard uid="u1" bottles={bottles} pours={p} />
      </MemoryRouter>
    </SommelierProvider>,
  )
}

const syncCalls = () => mockCall.mock.calls.filter(([d]) => (d as { reason?: string }).reason)
const explainCalls = () => mockCall.mock.calls.filter(([d]) => (d as { mode?: string }).mode === 'explain-insight')

beforeEach(() => {
  localStorage.clear()
  mockCall.mockReset()
  mockAskSommelier.mockReset().mockResolvedValue('Because your Rye pours average 9.0.')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('AXE Insight card', () => {
  it('renders from the cache with no server or AI call when nothing changed (mount, then remount)', async () => {
    const view = serverView()
    localStorage.setItem('fip:axeInsights:u1', JSON.stringify(view))
    localStorage.setItem('fip:axeInsights:explanation:u1', JSON.stringify({ fingerprint: view.selectedFingerprint, version: 1, explanation: AI }))

    const first = await renderCard()
    expect(screen.getByRole('heading', { name: AI.headline })).toBeInTheDocument()
    expect(screen.getByText('Palate Evolution')).toBeInTheDocument()
    first.unmount()
    await renderCard()
    expect(screen.getByRole('heading', { name: AI.headline })).toBeInTheDocument()
    await act(async () => {})
    expect(mockCall).not.toHaveBeenCalled()
  })

  it('shows the deterministic wording at once, then AXE wording, asking AXE only once per insight', async () => {
    const view = serverView()
    localStorage.setItem('fip:axeInsights:u1', JSON.stringify(view))
    mockCall.mockResolvedValue({ data: { status: 'generated', source: 'ai', fingerprint: view.selectedFingerprint, explanation: AI } })

    const first = await renderCard()
    expect(screen.getByRole('heading', { name: view.selected.copy.headline })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: AI.headline })).toBeInTheDocument()
    first.unmount()
    await renderCard()
    expect(screen.getByRole('heading', { name: AI.headline })).toBeInTheDocument()
    expect(explainCalls()).toHaveLength(1)
    expect(syncCalls()).toHaveLength(0)
  })

  it('asks the server once when there is no cache yet', async () => {
    const view = serverView()
    mockCall.mockImplementation(async (d: { reason?: string }) =>
      d.reason ? { data: view } : { data: { status: 'budget', source: 'deterministic', fingerprint: view.selectedFingerprint, explanation: null } },
    )
    await renderCard()
    expect(screen.getByText('AXE is looking over your journey…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: view.selected.copy.headline })).toBeInTheDocument()
    expect(syncCalls()).toEqual([[expect.objectContaining({ reason: 'home' })]])
  })

  it('marks an insight computed from older data instead of passing it off as current', async () => {
    const older = serverView(pours.slice(0, 4).concat({ ...pours[4]!, rating: 7.2 }))
    localStorage.setItem('fip:axeInsights:u1', JSON.stringify(older))
    let resolve: (v: unknown) => void = () => {}
    mockCall.mockImplementation((d: { reason?: string }) => (d.reason ? new Promise((r) => (resolve = r)) : Promise.resolve({ data: { source: 'deterministic' } })))
    await renderCard()
    expect(await screen.findByText('Updating with your latest tastings…')).toBeInTheDocument()
    await act(async () => resolve({ data: { ...serverView(), generation: 2 } }))
    await waitFor(() => expect(screen.queryByText('Updating with your latest tastings…')).not.toBeInTheDocument())
  })

  it('keeps working when the insights service is unavailable', async () => {
    const older = serverView(pours.slice(0, 4).concat({ ...pours[4]!, rating: 7.2 }), Date.parse('2026-10-10T18:00:00Z'))
    localStorage.setItem('fip:axeInsights:u1', JSON.stringify(older))
    mockCall.mockRejectedValue(Object.assign(new Error('not found'), { code: 'functions/not-found' }))
    await renderCard()
    // Still the last known insight, honestly dated.
    expect(screen.getByRole('heading', { name: older.selected.copy.headline })).toBeInTheDocument()
    expect(await screen.findByText(/From your tastings as of Oct 1[01]\./)).toBeInTheDocument()
  })

  it('shows an inviting empty state when there is no insight and the service is down', async () => {
    mockCall.mockRejectedValue(new Error('unavailable'))
    await renderCard()
    expect(await screen.findByText('AXE is still getting to know your palate.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore Your Palate' })).toHaveAttribute('href', '/profile')
  })

  it('opens the expanded view with verified facts, the tastings behind it, and related bottles', async () => {
    const view = serverView()
    localStorage.setItem('fip:axeInsights:u1', JSON.stringify(view))
    localStorage.setItem('fip:axeInsights:explanation:u1', JSON.stringify({ fingerprint: view.selectedFingerprint, version: 1, explanation: AI }))
    await renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Explore Insight' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Palate Evolution' }))
    expect(dialog.getByText('Worded by AXE from the facts below.')).toBeInTheDocument()
    expect(dialog.getByText('Average rating for Rye').nextElementSibling).toHaveTextContent('9.0')
    expect(dialog.getByText('Average rating for other styles').nextElementSibling).toHaveTextContent('7.2')
    expect(dialog.getByText('Rye pours').nextElementSibling).toHaveTextContent('3 pours')
    expect(dialog.getByText('An early pattern from 5 records. Worth watching as you log more.')).toBeInTheDocument()
    // Tastings come from the insight's evidence ids, shown with local calendar dates.
    expect(dialog.getAllByText('Rittenhouse').length).toBeGreaterThan(0)
    expect(dialog.getByText('Jan 3, 2026')).toBeInTheDocument()
    expect(dialog.getByRole('link', { name: 'Pikesville' })).toHaveAttribute('href', '/collection/r2')
    expect(dialog.queryByText('Maker’s Mark')).not.toBeInTheDocument() // not part of this insight's evidence
  })

  it('asks AXE about the insight through the existing chat, sending only its id', async () => {
    const view = serverView()
    localStorage.setItem('fip:axeInsights:u1', JSON.stringify(view))
    localStorage.setItem('fip:axeInsights:explanation:u1', JSON.stringify({ fingerprint: view.selectedFingerprint, version: 1, explanation: AI }))
    await renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Ask AXE' }))
    expect(await screen.findByText("Let's dig into what I noticed.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Why do you think that\?/ }))
    await waitFor(() => expect(mockAskSommelier).toHaveBeenCalled())
    const [, , context] = mockAskSommelier.mock.calls[0]!
    expect(context).toMatchObject({ insightId: view.selected.id })
    expect(context).not.toHaveProperty('facts')
  })
})
