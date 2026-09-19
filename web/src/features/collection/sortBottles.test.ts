import { describe, expect, it } from 'vitest'
import { sortBottles } from './sortBottles'
import type { Bottle, Pour } from '../../data/types'

const bottles: Bottle[] = [
  { id: 'b', name: 'Bookers', status: 'open', createdAt: 2, rating: 8.2, proof: 126.9 },
  { id: 'a', name: 'Angels Envy', status: 'open', createdAt: 3, rating: 9.0, proof: 100 },
  { id: 'c', name: 'Colonel E.H. Taylor', status: 'sealed', createdAt: 1, proof: 100 },
]

function minFip(rating: number) {
  return { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: rating, noseAromas: [], palateFlavors: [] }
}

describe('sortBottles', () => {
  it('sorts by most recently added by default', () => {
    expect(sortBottles(bottles, 'recent').map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts by name A-Z', () => {
    expect(sortBottles(bottles, 'name-asc').map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts by name Z-A', () => {
    expect(sortBottles(bottles, 'name-desc').map((b) => b.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts by highest rated, sinking unrated bottles to the bottom', () => {
    expect(sortBottles(bottles, 'rating-desc').map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts by proof high to low', () => {
    expect(sortBottles(bottles, 'proof-desc').map((b) => b.id)).toEqual(['b', 'a', 'c'])
  })

  it('does not mutate the input array', () => {
    const original = [...bottles]
    sortBottles(bottles, 'name-asc')
    expect(bottles).toEqual(original)
  })

  it('sorts by most recently poured, sinking never-poured bottles to the bottom', () => {
    const pours: Pour[] = [
      { id: 'p1', bottleId: 'b', date: '2026-06-01', rating: 8, fip: minFip(8) },
      { id: 'p2', bottleId: 'a', date: '2026-07-01', rating: 9, fip: minFip(9) },
    ]
    expect(sortBottles(bottles, 'poured-desc', pours).map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('defaults to no pours when none are given, so every bottle sinks to the bottom in input order', () => {
    expect(sortBottles(bottles, 'poured-desc').map((b) => b.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts by fill level, sinking bottles with no fill level to the bottom', () => {
    const withFill: Bottle[] = [
      { id: 'x', name: 'X', status: 'open', fillLevel: 'quarter' },
      { id: 'y', name: 'Y', status: 'open', fillLevel: 'full' },
      { id: 'z', name: 'Z', status: 'sealed' },
    ]
    expect(sortBottles(withFill, 'fill-desc').map((b) => b.id)).toEqual(['y', 'x', 'z'])
  })

  it('sorts by rarity, Unicorn first and unclassified bottles last', () => {
    const withRarity: Bottle[] = [
      { id: 'x', name: 'X', status: 'open', rarity: 'common', raritySource: 'manual' },
      { id: 'y', name: 'Y', status: 'open', rarity: 'unicorn', raritySource: 'manual' },
      { id: 'z', name: 'Z', status: 'open' },
    ]
    expect(sortBottles(withRarity, 'rarity-desc').map((b) => b.id)).toEqual(['y', 'x', 'z'])
  })

  it('sorts by purchase price, sinking bottles with no price to the bottom', () => {
    const withPrice: Bottle[] = [
      { id: 'x', name: 'X', status: 'sealed', price: 45.99 },
      { id: 'y', name: 'Y', status: 'sealed', price: 199 },
      { id: 'z', name: 'Z', status: 'sealed' },
    ]
    expect(sortBottles(withPrice, 'price-desc').map((b) => b.id)).toEqual(['y', 'x', 'z'])
  })

  it('sorts by quantity, treating an unset quantity as 1', () => {
    const withQuantity: Bottle[] = [
      { id: 'x', name: 'X', status: 'sealed', quantity: 3 },
      { id: 'y', name: 'Y', status: 'sealed' },
      { id: 'z', name: 'Z', status: 'sealed', quantity: 2 },
    ]
    expect(sortBottles(withQuantity, 'quantity-desc').map((b) => b.id)).toEqual(['x', 'z', 'y'])
  })
})
