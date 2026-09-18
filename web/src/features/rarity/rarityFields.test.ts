import { describe, expect, it } from 'vitest'
import { manualRarityFields, acceptedRarityFields, isRarityConfirmed, isRarityManual, confirmedRarityOf, isOwnedForRarity } from './rarityFields'
import type { RaritySuggestion } from '../../data/types'

function suggestion(overrides: Partial<RaritySuggestion> = {}): RaritySuggestion {
  return {
    rarity: 'allocated',
    confidence: 'high',
    reason: 'Usually released via store lottery.',
    identityKey: 'key1',
    generatedAt: 1000,
    classifierVersion: 'rarity-v1',
    ...overrides,
  }
}

describe('manualRarityFields', () => {
  it('sets a manual, confirmed rarity and clears AI confidence/reason/suggestion', () => {
    const fields = manualRarityFields('rare', 5000)
    expect(fields).toEqual({
      rarity: 'rare',
      raritySource: 'manual',
      rarityConfidence: undefined,
      rarityReason: undefined,
      rarityConfirmedAt: 5000,
      raritySuggestion: undefined,
    })
  })
})

describe('acceptedRarityFields', () => {
  it('copies a non-null suggestion into confirmed fields with suggested-confirmed provenance', () => {
    const fields = acceptedRarityFields(suggestion(), 5000)
    expect(fields).toEqual({
      rarity: 'allocated',
      raritySource: 'suggested-confirmed',
      rarityConfidence: 'high',
      rarityReason: 'Usually released via store lottery.',
      rarityConfirmedAt: 5000,
      raritySuggestion: undefined,
    })
  })

  it('is a no-op (returns null) for a declined suggestion — nothing to accept', () => {
    expect(acceptedRarityFields(suggestion({ rarity: null }))).toBeNull()
  })
})

describe('isRarityConfirmed / isRarityManual / confirmedRarityOf', () => {
  it('requires both rarity and raritySource to count as confirmed', () => {
    expect(isRarityConfirmed({ rarity: 'rare', raritySource: 'manual' })).toBe(true)
    expect(isRarityConfirmed({ rarity: undefined, raritySource: undefined })).toBe(false)
    expect(isRarityConfirmed({ rarity: 'rare', raritySource: undefined })).toBe(false)
  })

  it('a pending suggestion alone is never confirmed', () => {
    expect(isRarityConfirmed({ rarity: undefined, raritySource: undefined })).toBe(false)
  })

  it('identifies manual source specifically', () => {
    expect(isRarityManual({ raritySource: 'manual' })).toBe(true)
    expect(isRarityManual({ raritySource: 'suggested-confirmed' })).toBe(false)
    expect(isRarityManual({ raritySource: undefined })).toBe(false)
  })

  it('confirmedRarityOf returns the level only when confirmed', () => {
    expect(confirmedRarityOf({ rarity: 'unicorn', raritySource: 'manual' })).toBe('unicorn')
    expect(confirmedRarityOf({ rarity: undefined, raritySource: undefined })).toBeUndefined()
  })

  it('backward-compatible: a bottle with no rarity fields at all is safely unconfirmed', () => {
    expect(isRarityConfirmed({ rarity: undefined, raritySource: undefined })).toBe(false)
    expect(confirmedRarityOf({ rarity: undefined, raritySource: undefined })).toBeUndefined()
  })
})

describe('isOwnedForRarity', () => {
  it('excludes wishlist and incoming ("Buy Next")', () => {
    expect(isOwnedForRarity({ status: 'wishlist' })).toBe(false)
    expect(isOwnedForRarity({ status: 'incoming' })).toBe(false)
  })

  it('includes open, sealed, and finished', () => {
    expect(isOwnedForRarity({ status: 'open' })).toBe(true)
    expect(isOwnedForRarity({ status: 'sealed' })).toBe(true)
    expect(isOwnedForRarity({ status: 'finished' })).toBe(true)
  })
})
