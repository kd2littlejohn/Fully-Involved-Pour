import { describe, expect, it } from 'vitest'
import type { Bottle } from '../../data/types'
import { legacyBottles, legacyCandidates } from './legacyBottles'

const bottles: Bottle[] = [
  { id: 'a', name: 'Weller 12', status: 'open', createdAt: 3 },
  { id: 'b', name: "Blanton's", status: 'finished', legacyShelf: true, createdAt: 2 },
  { id: 'c', name: 'Eagle Rare', status: 'sealed', legacyShelf: true, legacyShelfReason: 'From Dad', createdAt: 5 },
  { id: 'd', name: 'Pappy 15', status: 'wishlist', legacyShelf: true, createdAt: 1 },
]

describe('legacyBottles', () => {
  it('keeps finished bottles, skips wishlist, and puts bottles with a story first', () => {
    expect(legacyBottles(bottles).map((b) => b.id)).toEqual(['c', 'b'])
  })
})

describe('legacyCandidates', () => {
  it('offers owned bottles that are not already Legacy', () => {
    expect(legacyCandidates(bottles).map((b) => b.id)).toEqual(['a'])
  })
})
