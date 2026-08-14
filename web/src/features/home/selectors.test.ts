import { describe, expect, it } from 'vitest'
import { getIncomingBottles, getMaybeTonightBottles } from './selectors'
import type { Bottle, Pour } from '../../data/types'

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

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)
}

function minFip(rating: number) {
  return { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: rating, noseAromas: [], palateFlavors: [] }
}

describe('getMaybeTonightBottles', () => {
  it('always includes sealed (owned, unopened) bottles', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Sealed Bottle', status: 'sealed', createdAt: 1 }]
    expect(getMaybeTonightBottles(bottles, []).map((b) => b.id)).toEqual(['a'])
  })

  it('excludes incoming, finished, and wishlist bottles', () => {
    const bottles: Bottle[] = [
      { id: 'a', name: 'Incoming', status: 'incoming', createdAt: 1 },
      { id: 'b', name: 'Finished', status: 'finished', createdAt: 1 },
      { id: 'c', name: 'Wishlist', status: 'wishlist', createdAt: 1 },
    ]
    expect(getMaybeTonightBottles(bottles, [])).toEqual([])
  })

  it('includes an open bottle that has never been poured', () => {
    const bottles: Bottle[] = [{ id: 'a', name: 'Untouched', status: 'open', openedDate: daysAgo(1), createdAt: 1 }]
    expect(getMaybeTonightBottles(bottles, []).map((b) => b.id)).toEqual(['a'])
  })

  it('includes an open bottle not poured in 14+ days, excludes one poured recently', () => {
    const stale: Bottle = { id: 'stale', name: 'Stale', status: 'open', createdAt: 1 }
    const fresh: Bottle = { id: 'fresh', name: 'Fresh', status: 'open', createdAt: 2 }
    const pours: Pour[] = [
      { id: 'p1', bottleId: 'stale', date: daysAgo(20), rating: 8, fip: minFip(8) },
      { id: 'p2', bottleId: 'fresh', date: daysAgo(2), rating: 8, fip: minFip(8) },
    ]

    const result = getMaybeTonightBottles([stale, fresh], pours).map((b) => b.id)
    expect(result).toContain('stale')
    expect(result).not.toContain('fresh')
  })

  it('surfaces the oldest additions first and respects the limit', () => {
    const bottles: Bottle[] = [
      { id: 'newest', name: 'Newest', status: 'sealed', createdAt: 3 },
      { id: 'oldest', name: 'Oldest', status: 'sealed', createdAt: 1 },
      { id: 'middle', name: 'Middle', status: 'sealed', createdAt: 2 },
    ]

    expect(getMaybeTonightBottles(bottles, [], 2).map((b) => b.id)).toEqual(['oldest', 'middle'])
  })
})
