import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bottle } from '../types'

const mockIsMockAuthEnabled = vi.fn()
const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockHttpsCallable = vi.fn()
const mockCallable = vi.fn()

vi.mock('../devMode', () => ({
  isMockAuthEnabled: () => mockIsMockAuthEnabled(),
}))

vi.mock('../firebase', () => ({
  db: {},
  functions: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({ __type: 'doc', path: args.slice(1).join('/') }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

const eagleRare: Bottle = {
  id: 'b1',
  name: 'Eagle Rare 10 Year',
  distillery: 'Buffalo Trace Distillery',
  status: 'open',
  proof: 90,
  ageStatement: '10 Year',
  mashBillCorn: 75,
  mashBillRyeWheat: 10,
  mashBillMalted: 4,
  msrp: 40,
}

const knownResult = {
  known: true,
  whySpecial: '10-year age statement with a classic profile.',
  bestFor: 'Bourbon drinkers who enjoy caramel and oak.',
  value: 'Strong near MSRP.',
  buyIf: 'You want a balanced age-stated bourbon.',
  skipIf: 'You prefer high proof.',
  verdict: 'Worth buying near retail.',
  story: 'A long-running favorite.',
  availability: 'Limited',
  flavorProfile: ['Caramel', 'Vanilla'],
  intensity: 0.6,
}

beforeEach(async () => {
  mockIsMockAuthEnabled.mockReset()
  mockGetDoc.mockReset()
  mockSetDoc.mockReset()
  mockHttpsCallable.mockReset()
  mockCallable.mockReset()
  mockHttpsCallable.mockReturnValue(mockCallable)
  mockSetDoc.mockResolvedValue(undefined)
  // Fresh module state per test — the mock-mode in-memory cache would
  // otherwise leak a guide generated in one test into the next.
  vi.resetModules()
})

async function importFipGuide() {
  return import('./fipGuide')
}

describe('getFipGuide', () => {
  it('returns undefined for a bottle name too short to search on, without touching Firestore or the Cloud Function', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    const { getFipGuide } = await importFipGuide()

    const result = await getFipGuide({ ...eagleRare, name: 'Ei' })

    expect(result).toBeUndefined()
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })

  it('returns the cached guide from Firestore without calling the Cloud Function', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    const cached = { bottleKey: 'eagle-rare-10-year__buffalo-trace-distillery', verdict: 'Cached verdict.' }
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => cached })
    const { getFipGuide } = await importFipGuide()

    const result = await getFipGuide(eagleRare)

    expect(result).toEqual(cached)
    expect(mockHttpsCallable).not.toHaveBeenCalled()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('generates and caches a new guide when none exists yet, keyed by normalized name + distillery', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockCallable.mockResolvedValue({ data: knownResult })
    const { getFipGuide } = await importFipGuide()

    const result = await getFipGuide(eagleRare)

    expect(mockCallable).toHaveBeenCalledWith({
      bottleName: 'Eagle Rare 10 Year',
      distillery: 'Buffalo Trace Distillery',
      type: undefined,
      proof: 90,
      ageStatement: '10 Year',
      mashBill: '75% corn, 10% rye/wheat, 4% malted barley',
      msrp: 40,
    })
    expect(result).toMatchObject({ whySpecial: knownResult.whySpecial, verdict: knownResult.verdict, flavorProfile: ['Caramel', 'Vanilla'] })
    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [docArg] = mockGetDoc.mock.calls[0]!
    expect(docArg.path).toBe('fipGuides/eagle-rare-10-year__buffalo-trace-distillery')
  })

  it('returns undefined and never caches when the AI does not confidently recognize the bottle', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockCallable.mockResolvedValue({ data: { known: false } })
    const { getFipGuide } = await importFipGuide()

    const result = await getFipGuide({ ...eagleRare, name: 'Some Totally Made Up Bottle' })

    expect(result).toBeUndefined()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('two bottles with the same name and distillery resolve to the same cache key', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockCallable.mockResolvedValue({ data: knownResult })
    const { getFipGuide } = await importFipGuide()

    await getFipGuide(eagleRare)
    await getFipGuide({ ...eagleRare, id: 'b2', price: 999, storeLocation: 'A totally different store' })

    const paths = mockGetDoc.mock.calls.map((call) => call[0].path)
    expect(paths[0]).toBe(paths[1])
  })

  it('in mock-auth dev mode, returns a deterministic guide without touching Firestore or Cloud Functions', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { getFipGuide } = await importFipGuide()

    const first = await getFipGuide(eagleRare)
    const second = await getFipGuide(eagleRare)

    expect(first).toBeDefined()
    expect(second).toEqual(first)
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })
})
