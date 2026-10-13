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
  vi.spyOn(console, 'warn').mockImplementation(() => {})
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
    expect(Object.keys(mockCall.mock.calls[0]![0]).sort()).toEqual(['reason', 'timeZone', 'today'])
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

    // Next app load, after the short backoff.
    vi.advanceTimersByTime(60_000)
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

describe('AXE Insights when the function is unavailable', () => {
  it('keeps serving the cached insight and backs off instead of calling on every save', async () => {
    const { syncAxeInsights, requestAxeInsightsSync, isAxeInsightsBackingOff, SYNC_DEBOUNCE_MS, BACKOFF_STEPS_MS } = await load()
    mockCall.mockResolvedValueOnce({ data: view(1) })
    await syncAxeInsights('u1', 'home')

    // e.g. a frontend that shipped before syncAxeInsights was deployed
    mockCall.mockRejectedValue(Object.assign(new Error('not found'), { code: 'functions/not-found' }))
    expect((await syncAxeInsights('u1', 'data-changed'))?.generation).toBe(1)
    expect(isAxeInsightsBackingOff('u1')).toBe(true)
    expect(mockCall).toHaveBeenCalledTimes(2)

    // More saves while backing off: no calls, still pending, still the cached insight.
    for (let i = 0; i < 5; i++) requestAxeInsightsSync('u1', 'data-changed')
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    expect(mockCall).toHaveBeenCalledTimes(2)
    expect((await syncAxeInsights('u1', 'home'))?.generation).toBe(1)
    expect(mockCall).toHaveBeenCalledTimes(2)

    // Backoff grows with repeated failures.
    vi.advanceTimersByTime(BACKOFF_STEPS_MS[0]!)
    await syncAxeInsights('u1', 'home')
    expect(mockCall).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(BACKOFF_STEPS_MS[0]!)
    expect(isAxeInsightsBackingOff('u1')).toBe(true) // now on the 5-minute step
  })

  it('recovers fully once the function is back', async () => {
    const { syncAxeInsights, recoverPendingAxeInsightsSync, isAxeInsightsBackingOff, pendingAxeInsightsReason, BACKOFF_STEPS_MS } = await load()
    mockCall.mockRejectedValueOnce(new Error('unavailable'))
    await syncAxeInsights('u1', 'data-changed')
    recoverPendingAxeInsightsSync('u1') // still backing off: no call
    await vi.advanceTimersByTimeAsync(0)
    expect(mockCall).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(BACKOFF_STEPS_MS[0]!)
    mockCall.mockResolvedValueOnce({ data: view(2) })
    recoverPendingAxeInsightsSync('u1')
    await vi.advanceTimersByTimeAsync(0)
    expect(mockCall).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'data-changed' }))
    expect(isAxeInsightsBackingOff('u1')).toBe(false)
    expect(pendingAxeInsightsReason('u1')).toBeNull()
  })
})

describe('AXE explanations on the client', () => {
  const candidate = {
    id: 'palate-evolution:style-preference:rye',
    category: 'palate-evolution',
    kind: 'style-preference',
    facts: [{ key: 'style', label: 'Style', value: 'Rye' }],
    sampleSize: 5,
    confidence: 'tentative',
    window: { label: 'all' },
    evidence: { pourIds: [], bottleIds: [], roomIds: [] },
    subjectBottleIds: [],
    actions: [{ id: 'open-palate', label: 'Explore Your Palate' }],
    copy: { headline: 'Rye may be your style.', body: 'Deterministic body.' },
    priority: 50,
  }
  const insightView = (fingerprint: string) => ({ status: 'ready' as const, generation: 1, selected: candidate as never, selectedFingerprint: fingerprint })
  const ai = { headline: 'Rye keeps earning your best scores.', body: 'AI body.', factKeys: ['style'] }

  it('shows the deterministic copy until AXE wording exists, and never depends on the model', async () => {
    const { currentAxeExplanation } = await load()
    expect(currentAxeExplanation('u1', insightView('fp1'))).toEqual({
      explanation: expect.objectContaining({ headline: 'Rye may be your style.', body: 'Deterministic body.' }),
      source: 'deterministic',
    })
  })

  it('asks once, caches by fingerprint, and reuses it after a refresh', async () => {
    const first = await load()
    mockCall.mockResolvedValueOnce({ data: { status: 'generated', source: 'ai', fingerprint: 'fp1', explanation: ai } })
    expect(await first.explainAxeInsight('u1', insightView('fp1'))).toEqual({ explanation: ai, source: 'ai' })
    expect(mockCall).toHaveBeenCalledWith({ mode: 'explain-insight' })

    vi.resetModules()
    const afterRefresh = await load()
    expect(afterRefresh.currentAxeExplanation('u1', insightView('fp1'))?.source).toBe('ai')
    await afterRefresh.explainAxeInsight('u1', insightView('fp1'))
    expect(mockCall).toHaveBeenCalledTimes(1)
  })

  it('asks again only for a new insight fingerprint', async () => {
    const { explainAxeInsight } = await load()
    mockCall.mockResolvedValue({ data: { status: 'generated', source: 'ai', fingerprint: 'fp1', explanation: ai } })
    await explainAxeInsight('u1', insightView('fp1'))
    mockCall.mockResolvedValue({ data: { status: 'generated', source: 'ai', fingerprint: 'fp2', explanation: ai } })
    await explainAxeInsight('u1', insightView('fp2'))
    expect(mockCall).toHaveBeenCalledTimes(2)
  })

  it('shares one request between concurrent callers and tries at most once per session on fallback', async () => {
    const { explainAxeInsight } = await load()
    mockCall.mockResolvedValue({ data: { status: 'budget', source: 'deterministic', fingerprint: 'fp1', explanation: candidate.copy } })
    const [a, b] = await Promise.all([explainAxeInsight('u1', insightView('fp1')), explainAxeInsight('u1', insightView('fp1'))])
    expect(a?.source).toBe('deterministic')
    expect(b?.source).toBe('deterministic')
    await explainAxeInsight('u1', insightView('fp1'))
    expect(mockCall).toHaveBeenCalledTimes(1)
  })

  it('falls back to the deterministic copy when the call fails or answers for a different insight', async () => {
    const { explainAxeInsight } = await load()
    mockCall.mockRejectedValueOnce(new Error('unavailable'))
    expect((await explainAxeInsight('u1', insightView('fp1')))?.explanation.body).toBe('Deterministic body.')
    mockCall.mockResolvedValueOnce({ data: { status: 'generated', source: 'ai', fingerprint: 'other', explanation: ai } })
    expect((await explainAxeInsight('u1', insightView('fp9')))?.source).toBe('deterministic')
  })
})
