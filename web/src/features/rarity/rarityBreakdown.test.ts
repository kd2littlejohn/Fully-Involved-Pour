import { describe, expect, it } from 'vitest'
import { rarityBreakdown } from './rarityBreakdown'
import type { Bottle } from '../../data/types'

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'status'>): Bottle {
  return { name: 'Test Bottle', ...overrides }
}

describe('rarityBreakdown', () => {
  it('returns the empty-inventory state (total 0, all rows 0) with no NaN when there are no owned bottles', () => {
    const { rows, total } = rarityBreakdown([])
    expect(total).toBe(0)
    for (const row of rows) {
      expect(row.count).toBe(0)
      expect(row.percent).toBe(0)
      expect(Number.isNaN(row.percent)).toBe(false)
    }
  })

  it('a bottle with no rarity fields counts as Unclassified', () => {
    const { rows, total } = rarityBreakdown([bottle({ id: 'b1', status: 'open' })])
    expect(total).toBe(1)
    expect(rows.find((r) => r.key === 'unclassified')?.count).toBe(1)
  })

  it('an unaccepted (pending) suggestion still counts as Unclassified, not the suggested level', () => {
    const b = bottle({ id: 'b1', status: 'open', raritySuggestion: { rarity: 'rare', confidence: 'high', reason: 'x', identityKey: 'k', generatedAt: 1, classifierVersion: 'v1' } })
    const { rows } = rarityBreakdown([b])
    expect(rows.find((r) => r.key === 'unclassified')?.count).toBe(1)
    expect(rows.find((r) => r.key === 'rare')?.count).toBe(0)
  })

  it('a declined suggestion (rarity: null) counts as Unclassified', () => {
    const b = bottle({ id: 'b1', status: 'open', raritySuggestion: { rarity: null, confidence: 'low', reason: 'x', identityKey: 'k', generatedAt: 1, classifierVersion: 'v1' } })
    const { rows } = rarityBreakdown([b])
    expect(rows.find((r) => r.key === 'unclassified')?.count).toBe(1)
  })

  it('a confirmed rarity counts toward its own level and moves out of Unclassified', () => {
    const b = bottle({ id: 'b1', status: 'open', rarity: 'rare', raritySource: 'manual' })
    const { rows } = rarityBreakdown([b])
    expect(rows.find((r) => r.key === 'rare')?.count).toBe(1)
    expect(rows.find((r) => r.key === 'unclassified')?.count).toBe(0)
  })

  it('weights each bottle by quantity, defaulting to 1 when unset', () => {
    const rare = bottle({ id: 'b1', status: 'open', rarity: 'rare', raritySource: 'manual', quantity: 3 })
    const common = bottle({ id: 'b2', status: 'sealed', rarity: 'common', raritySource: 'manual' })
    const { rows, total } = rarityBreakdown([rare, common])
    expect(rows.find((r) => r.key === 'rare')?.count).toBe(3)
    expect(rows.find((r) => r.key === 'common')?.count).toBe(1)
    expect(total).toBe(4)
  })

  it('excludes wishlist and incoming bottles from totals regardless of quantity', () => {
    const wishlist = bottle({ id: 'b1', status: 'wishlist', rarity: 'unicorn', raritySource: 'manual', quantity: 5 })
    const incoming = bottle({ id: 'b2', status: 'incoming', rarity: 'unicorn', raritySource: 'manual', quantity: 5 })
    const owned = bottle({ id: 'b3', status: 'open', rarity: 'common', raritySource: 'manual' })
    const { rows, total } = rarityBreakdown([wishlist, incoming, owned])
    expect(total).toBe(1)
    expect(rows.find((r) => r.key === 'unicorn')?.count).toBe(0)
    expect(rows.find((r) => r.key === 'common')?.count).toBe(1)
  })

  it('computes real percentages that sum to 100 across all 6 rows', () => {
    const bottles = [
      bottle({ id: 'b1', status: 'open', rarity: 'common', raritySource: 'manual' }),
      bottle({ id: 'b2', status: 'open', rarity: 'common', raritySource: 'manual' }),
      bottle({ id: 'b3', status: 'open', rarity: 'rare', raritySource: 'manual' }),
      bottle({ id: 'b4', status: 'open' }),
    ]
    const { rows } = rarityBreakdown(bottles)
    expect(rows.find((r) => r.key === 'common')?.percent).toBe(50)
    expect(rows.find((r) => r.key === 'rare')?.percent).toBe(25)
    expect(rows.find((r) => r.key === 'unclassified')?.percent).toBe(25)
    expect(rows.reduce((sum, r) => sum + r.percent, 0)).toBe(100)
  })

  it('backward-compatible: a bare legacy bottle with only id/name/status never throws', () => {
    expect(() => rarityBreakdown([{ id: 'b1', name: 'Old Bottle', status: 'open' }])).not.toThrow()
  })
})
