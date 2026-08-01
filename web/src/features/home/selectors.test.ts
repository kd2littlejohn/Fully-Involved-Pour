import { describe, expect, it } from 'vitest'
import { getIncomingBottles } from './selectors'
import type { Bottle } from '../../data/types'

describe('getIncomingBottles', () => {
  it('returns only incoming bottles, soonest expected arrival first', () => {
    const bottles: Bottle[] = [
      { id: 'a', name: 'Later Bottle', status: 'incoming', expectedDate: '2026-09-01', createdAt: 1 },
      { id: 'b', name: 'Sealed Bottle', status: 'sealed', createdAt: 2 },
      { id: 'c', name: 'Sooner Bottle', status: 'incoming', expectedDate: '2026-08-05', createdAt: 3 },
    ]

    const result = getIncomingBottles(bottles)

    expect(result.map((b) => b.name)).toEqual(['Sooner Bottle', 'Later Bottle'])
  })

  it('returns an empty array when nothing is incoming', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Sealed Bottle', status: 'sealed', createdAt: 1 }]
    expect(getIncomingBottles(bottles)).toEqual([])
  })
})
