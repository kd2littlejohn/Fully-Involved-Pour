import { describe, expect, it } from 'vitest'
import { selectRarityReviewQueue, needsFetch, highConfidenceAcceptableIds } from './rarityReviewQueue'
import { rarityIdentity, rarityIdentityKey } from '../../data/repositories/rarity'
import type { Bottle } from '../../data/types'

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'status'>): Bottle {
  return { name: 'Test Bottle', ...overrides }
}

describe('selectRarityReviewQueue', () => {
  it('excludes wishlist and incoming bottles', () => {
    const wishlist = bottle({ id: 'b1', status: 'wishlist' })
    const incoming = bottle({ id: 'b2', status: 'incoming' })
    expect(selectRarityReviewQueue([wishlist, incoming])).toEqual([])
  })

  it('excludes already-confirmed (manual or suggested-confirmed) bottles', () => {
    const manual = bottle({ id: 'b1', status: 'open', rarity: 'rare', raritySource: 'manual' })
    const confirmed = bottle({ id: 'b2', status: 'open', rarity: 'common', raritySource: 'suggested-confirmed' })
    expect(selectRarityReviewQueue([manual, confirmed])).toEqual([])
  })

  it('includes a bottle with no rarity data and one with only a pending suggestion', () => {
    const bare = bottle({ id: 'b1', status: 'open', name: 'Bare' })
    const pending = bottle({ id: 'b2', status: 'sealed', name: 'Pending', raritySuggestion: { rarity: 'rare', confidence: 'high', reason: 'x', identityKey: 'k', generatedAt: 1, classifierVersion: 'v1' } })
    const result = selectRarityReviewQueue([bare, pending])
    expect(result.map((b) => b.id).sort()).toEqual(['b1', 'b2'])
  })

  it('sorts by name for a stable render order', () => {
    const b = bottle({ id: 'b1', status: 'open', name: 'Zebra' })
    const a = bottle({ id: 'b2', status: 'open', name: 'Apple' })
    expect(selectRarityReviewQueue([b, a]).map((x) => x.id)).toEqual(['b2', 'b1'])
  })
})

describe('needsFetch', () => {
  it('is true when there is no suggestion at all', () => {
    expect(needsFetch(bottle({ id: 'b1', status: 'open' }))).toBe(true)
  })

  it('is false when the existing suggestion matches the current identity', () => {
    const b = bottle({ id: 'b1', status: 'open', name: 'Eagle Rare', distillery: 'Buffalo Trace' })
    const key = rarityIdentityKey(rarityIdentity(b))
    b.raritySuggestion = { rarity: 'rare', confidence: 'high', reason: 'x', identityKey: key, generatedAt: 1, classifierVersion: 'v1' }
    expect(needsFetch(b)).toBe(false)
  })

  it('is true when the bottle identity changed since the suggestion was generated', () => {
    const b = bottle({ id: 'b1', status: 'open', name: 'Eagle Rare', distillery: 'Buffalo Trace' })
    b.raritySuggestion = { rarity: 'rare', confidence: 'high', reason: 'x', identityKey: 'stale-key::rarity-v1', generatedAt: 1, classifierVersion: 'v1' }
    expect(needsFetch(b)).toBe(true)
  })
})

describe('highConfidenceAcceptableIds', () => {
  it('includes only fresh, high-confidence, non-null pending suggestions', () => {
    const high = bottle({ id: 'b1', status: 'open', name: 'High' })
    high.raritySuggestion = { rarity: 'rare', confidence: 'high', reason: 'x', identityKey: rarityIdentityKey(rarityIdentity(high)), generatedAt: 1, classifierVersion: 'v1' }

    const medium = bottle({ id: 'b2', status: 'open', name: 'Medium' })
    medium.raritySuggestion = { rarity: 'common', confidence: 'medium', reason: 'x', identityKey: rarityIdentityKey(rarityIdentity(medium)), generatedAt: 1, classifierVersion: 'v1' }

    const declined = bottle({ id: 'b3', status: 'open', name: 'Declined' })
    declined.raritySuggestion = { rarity: null, confidence: 'high', reason: 'x', identityKey: rarityIdentityKey(rarityIdentity(declined)), generatedAt: 1, classifierVersion: 'v1' }

    const stale = bottle({ id: 'b4', status: 'open', name: 'Stale' })
    stale.raritySuggestion = { rarity: 'rare', confidence: 'high', reason: 'x', identityKey: 'stale::rarity-v1', generatedAt: 1, classifierVersion: 'v1' }

    expect(highConfidenceAcceptableIds([high, medium, declined, stale])).toEqual(['b1'])
  })
})
