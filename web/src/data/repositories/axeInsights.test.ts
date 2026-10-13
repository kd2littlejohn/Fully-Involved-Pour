import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCall = vi.fn()
const mockSetDoc = vi.fn()
let mockMode = false

vi.mock('firebase/functions', () => ({
  httpsCallable: () => (data: unknown) => mockCall(data),
}))
vi.mock('firebase/firestore', () => ({
  doc: (...path: unknown[]) => path.join('/'),
  getDoc: vi.fn(),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}))
vi.mock('../firebase', () => ({ db: {}, functions: {} }))
vi.mock('../devMode', () => ({ isMockAuthEnabled: () => mockMode }))

const view = (generation: number, id = `insight-${generation}`) => ({
  status: 'ready',
  generation,
  selected: { id, copy: { headline: `Headline ${generation}`, body: 'Body' } },
})

async function load() {
  return import('./axeInsights')
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  mockCall.mockReset()
  mockSetDoc.mockReset().mockResolvedValue(undefined)
  mockMode = false
  localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('AXE Insights client events', () => {
  it('coalesces a burst of events into one request with the strongest reason', async () => {
    const { requestAxeInsightsSync, SYNC_DEBOUNCE_MS } = await load()
    mockCall.mockResolvedValue({ data: view(1) })
    requestAxeInsightsSync('u1', 'data-changed')
    requestAxeInsightsSync('u1', 'blind-reveal')
    requestAxeInsightsSync('u1', 'data-changed')
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    expect(mockCall).toHaveBeenCalledTimes(1)
    expect(mockCall.mock.calls[0]![0]).toMatchObject({ reason: 'blind-reveal', today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  })

  it('sends no statistics or user data, only a reason and the local date', async () => {
    const { syncAxeInsights } = await load()
    mockCall.mockResolvedValue({ data: view(1) })
    await syncAxeInsights('u1', 'home')
    expect(Object.keys(mockCall.mock.calls[0]![0]).sort()).toEqual(['reason', 'today'])
  })

  it('triggers on saves that touch pours or bottles, and only after the save succeeds', async () => {
    const { saveUserDoc } = await import('./userDoc')
    const { SYNC_DEBOUNCE_MS } = await load()
    mockCall.mockResolvedValue({ data: view(1) })

    await saveUserDoc('u1', { people: [] })
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    expect(mockCall).not.toHaveBeenCalled()

    mockSetDoc.mockRejectedValueOnce(new Error('offline'))
    await expect(saveUserDoc('u1', { pours: [] })).rejects.toThrow('offline')
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    expect(mockCall).not.toHaveBeenCalled()

    await saveUserDoc('u1', { pours: [], bottles: [] })
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    expect(mockCall).toHaveBeenCalledTimes(1)
    expect(mockCall.mock.calls[0]![0].reason).toBe('data-changed')
  })

  it('notifies a blind reveal once per room per session', async () => {
    const { notifyBlindRevealed, SYNC_DEBOUNCE_MS } = await load()
    mockCall.mockResolvedValue({ data: view(1) })
    notifyBlindRevealed('u1', 'room1')
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    notifyBlindRevealed('u1', 'room1')
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    expect(mockCall).toHaveBeenCalledTimes(1)
  })

  it('makes no requests under mock (dev) auth', async () => {
    mockMode = true
    const { requestAxeInsightsSync, SYNC_DEBOUNCE_MS } = await load()
    requestAxeInsightsSync('u1', 'data-changed')
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    expect(mockCall).not.toHaveBeenCalled()
  })
})

describe('AXE Insights client cache', () => {
  it('persists the last insight across a page refresh (module reload)', async () => {
    const first = await load()
    mockCall.mockResolvedValue({ data: view(3) })
    await first.syncAxeInsights('u1', 'home')

    vi.resetModules()
    const afterRefresh = await load()
    expect(afterRefresh.readCachedAxeInsights('u1')?.selected?.id).toBe('insight-3')
    expect(afterRefresh.readCachedAxeInsights('someone-else')).toBeNull()
  })

  it('never lets an older response overwrite a newer cached insight', async () => {
    const { syncAxeInsights, readCachedAxeInsights } = await load()
    mockCall.mockResolvedValueOnce({ data: view(5) })
    await syncAxeInsights('u1', 'home')
    mockCall.mockResolvedValueOnce({ data: view(4) }) // a slow, older reply
    await syncAxeInsights('u1', 'home')
    expect(readCachedAxeInsights('u1')?.generation).toBe(5)
  })
})

describe('AXE Insights failed-event recovery', () => {
  it('keeps the cached insight on failure, remembers the event, and retries it on the next load', async () => {
    const first = await load()
    mockCall.mockResolvedValueOnce({ data: view(1) })
    await first.syncAxeInsights('u1', 'home')

    mockCall.mockRejectedValueOnce(new Error('network down'))
    const result = await first.syncAxeInsights('u1', 'data-changed')
    expect(result?.generation).toBe(1) // still shows the last good insight
    expect(first.pendingAxeInsightsReason('u1')).toBe('data-changed')

    // Next app load.
    vi.resetModules()
    const next = await load()
    mockCall.mockResolvedValueOnce({ data: view(2) })
    next.recoverPendingAxeInsightsSync('u1')
    await vi.advanceTimersByTimeAsync(0)
    expect(mockCall).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'data-changed' }))
    expect(next.pendingAxeInsightsReason('u1')).toBeNull()
    expect(next.readCachedAxeInsights('u1')?.generation).toBe(2)
  })

  it('marks an event pending immediately, so closing the tab before it is sent still recovers', async () => {
    const { requestAxeInsightsSync, pendingAxeInsightsReason } = await load()
    requestAxeInsightsSync('u1', 'data-changed')
    expect(pendingAxeInsightsReason('u1')).toBe('data-changed')
    expect(mockCall).not.toHaveBeenCalled()
  })

  it('does nothing on load when there is nothing pending', async () => {
    const { recoverPendingAxeInsightsSync } = await load()
    recoverPendingAxeInsightsSync('u1')
    await vi.advanceTimersByTimeAsync(0)
    expect(mockCall).not.toHaveBeenCalled()
  })
})
