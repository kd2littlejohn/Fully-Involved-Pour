import { describe, expect, it } from 'vitest'
import { getAverageProof, getCollectionStats, getFavoriteBottle, getFavoriteFlavors, getLegacyShelfBottles, getMostSharedBottle } from './selectors'
import type { Bottle, Pour } from '../../data/types'

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open', proof: 90, flavors: ['Caramel', 'Vanilla'], createdAt: 1 },
  { id: 'b2', name: 'Weller 12', status: 'sealed', proof: 90, flavors: ['Vanilla', 'Honey'], createdAt: 2 },
  { id: 'b3', name: "Blanton's", status: 'open', proof: 93, legacyShelf: true, legacyShelfReason: 'First bourbon I loved', createdAt: 3 },
  { id: 'b4', name: 'No proof bottle', status: 'wishlist', createdAt: 4 },
]

const pours: Pour[] = [
  {
    id: 'p1',
    bottleId: 'b1',
    date: '2026-01-01',
    rating: 9,
    companion: 'Dad',
    fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: 9, noseAromas: [], palateFlavors: [] },
  },
  {
    id: 'p2',
    bottleId: 'b1',
    date: '2026-02-01',
    rating: 8,
    companion: 'Mike',
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: 8, noseAromas: [], palateFlavors: [] },
  },
  {
    id: 'p3',
    bottleId: 'b2',
    date: '2026-03-01',
    rating: 7,
    fip: { nose: 1.5, palate: 2.5, finish: 1.5, complexity: 0.75, value: 0.75, total: 7, noseAromas: [], palateFlavors: [] },
  },
]

describe('getCollectionStats', () => {
  it('tallies bottles by status plus pour and memory counts', () => {
    expect(getCollectionStats(bottles, pours, 3)).toEqual({
      totalBottles: 4,
      openBottles: 2,
      sealedBottles: 1,
      wishlistBottles: 1,
      finishedBottles: 0,
      totalPours: 3,
      totalMemories: 3,
    })
  })
})

describe('getAverageProof', () => {
  it('averages only bottles with a proof value', () => {
    expect(getAverageProof(bottles)).toBeCloseTo((90 + 90 + 93) / 3, 5)
  })

  it('returns undefined when no bottle has a proof', () => {
    expect(getAverageProof([{ id: 'x', name: 'X', status: 'sealed' }])).toBeUndefined()
  })
})

describe('getFavoriteFlavors', () => {
  it('counts flavor tags across the whole collection, sorted descending', () => {
    expect(getFavoriteFlavors(bottles)).toEqual([
      { name: 'Vanilla', count: 2 },
      { name: 'Caramel', count: 1 },
      { name: 'Honey', count: 1 },
    ])
  })
})

describe('getMostSharedBottle', () => {
  it('picks the bottle with the most pours that had a companion', () => {
    const result = getMostSharedBottle(bottles, pours)
    expect(result?.bottle.id).toBe('b1')
    expect(result?.sharedPourCount).toBe(2)
  })

  it('returns undefined when no pour has a companion', () => {
    expect(getMostSharedBottle(bottles, [])).toBeUndefined()
  })
})

describe('getLegacyShelfBottles', () => {
  it('returns only bottles flagged legacyShelf', () => {
    expect(getLegacyShelfBottles(bottles).map((b) => b.id)).toEqual(['b3'])
  })
})

describe('getFavoriteBottle', () => {
  it('returns undefined when no bottle is explicitly marked a favorite', () => {
    expect(getFavoriteBottle(bottles, pours)).toBeUndefined()
  })

  it('picks the highest-scoring bottle among those explicitly favorited by the user', () => {
    const favorited: Bottle[] = [
      { ...bottles[0]!, favorite: true }, // b1, latest pour rating 8
      { ...bottles[1]!, favorite: true }, // b2, latest pour rating 7
    ]
    const result = getFavoriteBottle(favorited, pours)
    expect(result?.id).toBe('b1')
  })

  it('falls back to most recently added on a tie, never fabricating a winner', () => {
    const favorited: Bottle[] = [
      { id: 'x', name: 'X', status: 'open', favorite: true, createdAt: 1 },
      { id: 'y', name: 'Y', status: 'open', favorite: true, createdAt: 2 },
    ]
    expect(getFavoriteBottle(favorited, [])?.id).toBe('y')
  })
})
