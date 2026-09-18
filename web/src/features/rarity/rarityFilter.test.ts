import { describe, expect, it } from 'vitest'
import { matchesRarityFilter } from './rarityFilter'
import type { Bottle } from '../../data/types'

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'status'>): Bottle {
  return { name: 'Test Bottle', ...overrides }
}

describe('matchesRarityFilter', () => {
  it('null matches everything (no filter active)', () => {
    expect(matchesRarityFilter(bottle({ id: 'b1', status: 'open' }), null)).toBe(true)
    expect(matchesRarityFilter(bottle({ id: 'b1', status: 'open', rarity: 'rare', raritySource: 'manual' }), null)).toBe(true)
  })

  it('a specific level only matches bottles confirmed at exactly that level', () => {
    const rare = bottle({ id: 'b1', status: 'open', rarity: 'rare', raritySource: 'manual' })
    const common = bottle({ id: 'b2', status: 'open', rarity: 'common', raritySource: 'manual' })
    expect(matchesRarityFilter(rare, 'rare')).toBe(true)
    expect(matchesRarityFilter(common, 'rare')).toBe(false)
  })

  it('"unclassified" matches bottles without confirmed rarity, including ones with a pending suggestion', () => {
    const none = bottle({ id: 'b1', status: 'open' })
    const pending = bottle({ id: 'b2', status: 'open', raritySuggestion: { rarity: 'rare', confidence: 'high', reason: 'x', identityKey: 'k', generatedAt: 1, classifierVersion: 'v1' } })
    const confirmed = bottle({ id: 'b3', status: 'open', rarity: 'rare', raritySource: 'manual' })
    expect(matchesRarityFilter(none, 'unclassified')).toBe(true)
    expect(matchesRarityFilter(pending, 'unclassified')).toBe(true)
    expect(matchesRarityFilter(confirmed, 'unclassified')).toBe(false)
  })

  it('applies regardless of bottle status — a rarity filter can still match a wishlist bottle', () => {
    const wishlistRare = bottle({ id: 'b1', status: 'wishlist', rarity: 'rare', raritySource: 'manual' })
    expect(matchesRarityFilter(wishlistRare, 'rare')).toBe(true)
  })
})
