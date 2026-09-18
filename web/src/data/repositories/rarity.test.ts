import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RaritySuggestion } from '../types'

const mockIsMockAuthEnabled = vi.fn()
const mockHttpsCallable = vi.fn()
const mockCallable = vi.fn()

vi.mock('../devMode', () => ({
  isMockAuthEnabled: () => mockIsMockAuthEnabled(),
}))

vi.mock('../firebase', () => ({
  functions: {},
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

describe('rarity repository', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockHttpsCallable.mockReturnValue(mockCallable)
    // reset the vitest module registry's identity-key classifier version by
    // re-importing fresh each test isn't needed since it's a pure constant.
  })

  it('hasSufficientRarityIdentity requires a real name plus distillery or type', async () => {
    const { hasSufficientRarityIdentity } = await import('./rarity')
    expect(hasSufficientRarityIdentity({ bottleName: 'Eagle Rare', distillery: 'Buffalo Trace' })).toBe(true)
    expect(hasSufficientRarityIdentity({ bottleName: 'Eagle Rare', type: 'Bourbon' })).toBe(true)
    expect(hasSufficientRarityIdentity({ bottleName: 'Eagle Rare' })).toBe(false)
    expect(hasSufficientRarityIdentity({ bottleName: 'EX', distillery: 'Buffalo Trace' })).toBe(false)
  })

  it('rarityIdentityKey changes when any identity field changes, stable when unchanged', async () => {
    const { rarityIdentityKey } = await import('./rarity')
    const a = { bottleName: 'Eagle Rare', distillery: 'Buffalo Trace' }
    const b = { bottleName: 'Eagle Rare', distillery: 'Buffalo Trace' }
    const c = { bottleName: 'Eagle Rare', distillery: 'Four Roses' }
    expect(rarityIdentityKey(a)).toBe(rarityIdentityKey(b))
    expect(rarityIdentityKey(a)).not.toBe(rarityIdentityKey(c))
  })

  it('detectPickFlags recognizes single-barrel and store-pick phrasing in a name', async () => {
    const { detectPickFlags } = await import('./rarity')
    expect(detectPickFlags('Eagle Rare Single Barrel Select')).toEqual({ singleBarrel: true, storePick: false })
    expect(detectPickFlags("Joe's Liquor Barrel Pick")).toEqual({ singleBarrel: false, storePick: true })
    expect(detectPickFlags('Eagle Rare 10 Year')).toEqual({ singleBarrel: false, storePick: false })
  })

  it('reuses a still-valid existing suggestion with zero network calls (duplicate-request avoidance)', async () => {
    const { requestRaritySuggestion, rarityIdentityKey, RARITY_CLASSIFIER_VERSION } = await import('./rarity')
    const identity = { bottleName: 'Eagle Rare', distillery: 'Buffalo Trace' }
    const existing: RaritySuggestion = {
      rarity: 'uncommon',
      confidence: 'medium',
      reason: 'x',
      identityKey: rarityIdentityKey(identity),
      generatedAt: 1,
      classifierVersion: RARITY_CLASSIFIER_VERSION,
    }
    const outcome = await requestRaritySuggestion(identity, existing)
    expect(outcome).toEqual({ status: 'ready', suggestion: existing })
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })

  it('requests a fresh suggestion when identity has changed since the existing one was generated', async () => {
    const { requestRaritySuggestion } = await import('./rarity')
    mockCallable.mockResolvedValue({
      data: { rarity: 'rare', confidence: 'high', reason: 'Very limited.', generatedAt: 2, classifierVersion: 'rarity-v1' },
    })
    const stale: RaritySuggestion = {
      rarity: 'common',
      confidence: 'low',
      reason: 'stale',
      identityKey: 'some-other-identity::rarity-v1',
      generatedAt: 1,
      classifierVersion: 'rarity-v1',
    }
    const outcome = await requestRaritySuggestion({ bottleName: 'Eagle Rare', distillery: 'Buffalo Trace' }, stale)
    expect(outcome.status).toBe('ready')
    expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'suggestBottleRarity')
    expect(mockCallable).toHaveBeenCalledTimes(1)
  })

  it('maps a resource-exhausted error to "unavailable"', async () => {
    const { requestRaritySuggestion } = await import('./rarity')
    mockCallable.mockRejectedValue({ code: 'functions/resource-exhausted' })
    const outcome = await requestRaritySuggestion({ bottleName: 'Eagle Rare', distillery: 'Buffalo Trace' })
    expect(outcome).toEqual({ status: 'unavailable' })
  })

  it('maps any other error to "failed" without throwing', async () => {
    const { requestRaritySuggestion } = await import('./rarity')
    mockCallable.mockRejectedValue(new Error('boom'))
    const outcome = await requestRaritySuggestion({ bottleName: 'Eagle Rare', distillery: 'Buffalo Trace' })
    expect(outcome).toEqual({ status: 'failed' })
  })

  it('a suggestion with rarity: null is still a "ready" outcome, not a failure', async () => {
    const { requestRaritySuggestion } = await import('./rarity')
    mockCallable.mockResolvedValue({
      data: { rarity: null, confidence: 'low', reason: 'Not confidently recognized.', generatedAt: 2, classifierVersion: 'rarity-v1' },
    })
    const outcome = await requestRaritySuggestion({ bottleName: 'Some Obscure Bottle', distillery: 'Unknown' })
    expect(outcome.status).toBe('ready')
    if (outcome.status === 'ready') expect(outcome.suggestion.rarity).toBeNull()
  })

  it('mock mode returns a canned suggestion with no callable invocation', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { requestRaritySuggestion } = await import('./rarity')
    const outcome = await requestRaritySuggestion({ bottleName: 'Eagle Rare', distillery: 'Buffalo Trace' })
    expect(outcome.status).toBe('ready')
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })
})
