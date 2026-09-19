import { describe, expect, it } from 'vitest'
import {
  isLowFill,
  needsReplacement,
  isRareOrUnicorn,
  isNeverReviewed,
  isNotPouredRecently,
  isDuplicateBottle,
  getInfinityIngredientBottleIds,
} from './inventoryFilters'
import type { Bottle, InfinityBottle, Pour } from '../../data/types'

const DAY_MS = 24 * 60 * 60 * 1000
function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)
}

function minFip(rating: number) {
  return { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: rating, noseAromas: [], palateFlavors: [] }
}

describe('isLowFill', () => {
  it('flags an open bottle at quarter or empty', () => {
    expect(isLowFill({ status: 'open', fillLevel: 'quarter' })).toBe(true)
    expect(isLowFill({ status: 'open', fillLevel: 'empty' })).toBe(true)
  })

  it('does not flag an open bottle above quarter', () => {
    expect(isLowFill({ status: 'open', fillLevel: 'half' })).toBe(false)
    expect(isLowFill({ status: 'open', fillLevel: undefined })).toBe(false)
  })

  it('never flags a sealed bottle regardless of fill level', () => {
    expect(isLowFill({ status: 'sealed', fillLevel: 'empty' })).toBe(false)
  })
})

describe('needsReplacement', () => {
  it('is true only when wouldReplace is yes', () => {
    expect(needsReplacement({ wouldReplace: 'yes' })).toBe(true)
    expect(needsReplacement({ wouldReplace: 'maybe' })).toBe(false)
    expect(needsReplacement({ wouldReplace: undefined })).toBe(false)
  })
})

describe('isRareOrUnicorn', () => {
  it('includes rare and unicorn', () => {
    expect(isRareOrUnicorn({ rarity: 'rare', raritySource: 'manual' })).toBe(true)
    expect(isRareOrUnicorn({ rarity: 'unicorn', raritySource: 'manual' })).toBe(true)
  })

  it('excludes common, uncommon, and unclassified bottles', () => {
    expect(isRareOrUnicorn({ rarity: 'common', raritySource: 'manual' })).toBe(false)
    expect(isRareOrUnicorn({ rarity: 'uncommon', raritySource: 'manual' })).toBe(false)
    expect(isRareOrUnicorn({ rarity: undefined, raritySource: undefined })).toBe(false)
  })

  it('excludes a rarity value with no confirming source (pending, never confirmed)', () => {
    expect(isRareOrUnicorn({ rarity: 'rare', raritySource: undefined })).toBe(false)
  })
})

describe('isNeverReviewed', () => {
  it('is true for an owned bottle with no rating and no pours', () => {
    const bottle: Bottle = { id: 'a', name: 'A', status: 'open' }
    expect(isNeverReviewed(bottle, [])).toBe(true)
  })

  it('is false once a pour carries a rating', () => {
    const bottle: Bottle = { id: 'a', name: 'A', status: 'open' }
    const pours: Pour[] = [{ id: 'p1', bottleId: 'a', date: daysAgo(1), rating: 8, fip: minFip(8) }]
    expect(isNeverReviewed(bottle, pours)).toBe(false)
  })

  it('is false when the bottle itself already carries a manually-set rating', () => {
    const bottle: Bottle = { id: 'a', name: 'A', status: 'sealed', rating: 7 }
    expect(isNeverReviewed(bottle, [])).toBe(false)
  })

  it('excludes wishlist and incoming bottles — nothing to review yet', () => {
    expect(isNeverReviewed({ id: 'a', name: 'A', status: 'wishlist' }, [])).toBe(false)
    expect(isNeverReviewed({ id: 'a', name: 'A', status: 'incoming' }, [])).toBe(false)
  })
})

describe('isNotPouredRecently', () => {
  it('is true for an open bottle never poured', () => {
    expect(isNotPouredRecently({ id: 'a', name: 'A', status: 'open' }, [])).toBe(true)
  })

  it('is true once the last pour is past the threshold', () => {
    const bottle: Bottle = { id: 'a', name: 'A', status: 'open' }
    const pours: Pour[] = [{ id: 'p1', bottleId: 'a', date: daysAgo(30), rating: 8, fip: minFip(8) }]
    expect(isNotPouredRecently(bottle, pours)).toBe(true)
  })

  it('is false when poured within the threshold', () => {
    const bottle: Bottle = { id: 'a', name: 'A', status: 'open' }
    const pours: Pour[] = [{ id: 'p1', bottleId: 'a', date: daysAgo(1), rating: 8, fip: minFip(8) }]
    expect(isNotPouredRecently(bottle, pours)).toBe(false)
  })

  it('never applies to a sealed bottle', () => {
    expect(isNotPouredRecently({ id: 'a', name: 'A', status: 'sealed' }, [])).toBe(false)
  })
})

describe('isDuplicateBottle', () => {
  it('is true when quantity is greater than one', () => {
    expect(isDuplicateBottle({ quantity: 2 })).toBe(true)
  })

  it('is true when instances has more than one entry', () => {
    expect(
      isDuplicateBottle({
        instances: [
          { id: 'i1', status: 'open', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 2 },
        ],
      }),
    ).toBe(true)
  })

  it('is false for a plain single bottle', () => {
    expect(isDuplicateBottle({})).toBe(false)
    expect(isDuplicateBottle({ quantity: 1 })).toBe(false)
  })
})

describe('getInfinityIngredientBottleIds', () => {
  it('collects sourceBottleId across every batch and vessel', () => {
    const infinityBottles: InfinityBottle[] = [
      {
        id: 'ib1',
        name: 'The House Blend',
        archived: false,
        createdAt: 1,
        batches: [
          {
            id: 'batch1',
            status: 'active',
            startedAt: 1,
            additions: [
              { id: 'a1', sourceBottleId: 'bottle-1', bottleName: 'Eagle Rare', amountMl: 50, date: '2026-01-01', createdAt: 1 },
              { id: 'a2', bottleName: 'Unknown Pour', amountMl: 30, date: '2026-01-02', createdAt: 2 },
            ],
            tastings: [],
          },
        ],
      },
      {
        id: 'ib2',
        name: 'Archived Batch',
        archived: true,
        createdAt: 1,
        batches: [
          {
            id: 'batch2',
            status: 'complete',
            startedAt: 1,
            additions: [{ id: 'a3', sourceBottleId: 'bottle-2', bottleName: 'Weller 12', amountMl: 40, date: '2026-01-03', createdAt: 3 }],
            tastings: [],
          },
        ],
      },
    ]

    expect(getInfinityIngredientBottleIds(infinityBottles)).toEqual(new Set(['bottle-1', 'bottle-2']))
  })

  it('returns an empty set for no infinity bottles', () => {
    expect(getInfinityIngredientBottleIds([])).toEqual(new Set())
  })
})
