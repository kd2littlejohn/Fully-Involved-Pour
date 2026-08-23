import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PalateProfile } from '../../features/yourPalate/palateProfile'

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

function profile(overrides: Partial<PalateProfile> = {}): PalateProfile {
  return {
    qualifyingPourCount: 5,
    maturity: 'taking-shape',
    categoryScores: [{ category: 'Bourbon', mode: 'frequency-only', pourCount: 5 }],
    proofAffinity: undefined,
    topRatedFlavors: [],
    loyalty: undefined,
    finishPreference: undefined,
    mouthfeelPreference: undefined,
    ...overrides,
  }
}

beforeEach(() => {
  mockIsMockAuthEnabled.mockReset()
  mockGetDoc.mockReset()
  mockSetDoc.mockReset()
  mockHttpsCallable.mockReset()
  mockCallable.mockReset()
  mockHttpsCallable.mockReturnValue(mockCallable)
  mockSetDoc.mockResolvedValue(undefined)
})

async function importPalateInterpretation() {
  return import('./palateInterpretation')
}

describe('getPalateInterpretation', () => {
  it('returns undefined below the maturity floor, without touching Firestore or the Cloud Function', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    const { getPalateInterpretation } = await importPalateInterpretation()

    const result = await getPalateInterpretation('u1', profile({ maturity: 'learning' }))

    expect(result).toBeUndefined()
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })

  it('returns the cached interpretation when the profile hash matches, without calling the Cloud Function', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    const { hashPalateProfile } = await importPalateInterpretation()
    const p = profile()
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ text: 'Cached text.', profileHash: hashPalateProfile(p), generatedAt: 1 }) })
    const { getPalateInterpretation } = await importPalateInterpretation()

    const result = await getPalateInterpretation('u1', p)

    expect(result).toBe('Cached text.')
    expect(mockHttpsCallable).not.toHaveBeenCalled()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('regenerates and overwrites the cache when the profile hash has changed since it was cached', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ text: 'Stale text.', profileHash: 'stale-hash', generatedAt: 1 }) })
    mockCallable.mockResolvedValue({ data: { known: true, interpretation: 'Fresh interpretation.' } })
    const { getPalateInterpretation } = await importPalateInterpretation()

    const result = await getPalateInterpretation('u1', profile())

    expect(result).toBe('Fresh interpretation.')
    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [docArg] = mockSetDoc.mock.calls[0]!
    expect(docArg.path).toBe('palateInterpretations/u1')
  })

  it('generates and caches a new interpretation from a minimal profile summary, never the raw bottle/pour history', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockCallable.mockResolvedValue({ data: { known: true, interpretation: 'You gravitate toward Bourbon.' } })
    const { getPalateInterpretation } = await importPalateInterpretation()

    const withLoyalty = profile({
      loyalty: { pouredBottleCount: 2, repeatBottleCount: 1, rate: 0.5, mostRepeated: { bottle: { id: 'b1', name: 'Eagle Rare', status: 'open' }, pourCount: 4 } },
    })
    const result = await getPalateInterpretation('u1', withLoyalty)

    expect(result).toBe('You gravitate toward Bourbon.')
    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({ mostRepeatedBottleName: 'Eagle Rare', mostRepeatedPourCount: 4 }),
    )
    // The full Bottle object never travels — only its name.
    const [sentInput] = mockCallable.mock.calls[0]!
    expect(sentInput).not.toHaveProperty('loyalty')
    expect(JSON.stringify(sentInput)).not.toContain('"status"')
  })

  it('returns undefined and never caches when the AI declines (known: false)', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockCallable.mockResolvedValue({ data: { known: false } })
    const { getPalateInterpretation } = await importPalateInterpretation()

    const result = await getPalateInterpretation('u1', profile())

    expect(result).toBeUndefined()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('in mock-auth dev mode, returns a deterministic interpretation without touching Firestore or Cloud Functions', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { getPalateInterpretation } = await importPalateInterpretation()

    const result = await getPalateInterpretation('u1', profile())

    expect(result).toBeTruthy()
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })
})

describe('hashPalateProfile', () => {
  it('is stable for the same meaningful fields', async () => {
    const { hashPalateProfile } = await importPalateInterpretation()
    expect(hashPalateProfile(profile())).toBe(hashPalateProfile(profile()))
  })

  it('changes when maturity changes', async () => {
    const { hashPalateProfile } = await importPalateInterpretation()
    expect(hashPalateProfile(profile({ maturity: 'taking-shape' }))).not.toBe(hashPalateProfile(profile({ maturity: 'developing' })))
  })

  it('changes when the top category changes', async () => {
    const { hashPalateProfile } = await importPalateInterpretation()
    const a = profile({ categoryScores: [{ category: 'Bourbon', mode: 'frequency-only', pourCount: 5 }] })
    const b = profile({ categoryScores: [{ category: 'Rye', mode: 'frequency-only', pourCount: 5 }] })
    expect(hashPalateProfile(a)).not.toBe(hashPalateProfile(b))
  })
})
