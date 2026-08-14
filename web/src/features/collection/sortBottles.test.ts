import { describe, expect, it } from 'vitest'
import { sortBottles } from './sortBottles'
import type { Bottle } from '../../data/types'

const bottles: Bottle[] = [
  { id: 'b', name: 'Bookers', status: 'open', createdAt: 2, rating: 8.2, proof: 126.9 },
  { id: 'a', name: 'Angels Envy', status: 'open', createdAt: 3, rating: 9.0, proof: 100 },
  { id: 'c', name: 'Colonel E.H. Taylor', status: 'sealed', createdAt: 1, proof: 100 },
]

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
})
