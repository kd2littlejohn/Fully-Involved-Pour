import { describe, expect, it } from 'vitest'
import { buildBottleTastingSummary } from './bottleTastingSummary'
import type { Bottle, Pour } from './types'

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'name' | 'status'>): Bottle {
  return overrides
}

function pour(
  overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'> & { noseAromas?: string[]; palateFlavors?: string[]; finishNotes?: string },
): Pour {
  const { noseAromas = [], palateFlavors = [], finishNotes, ...rest } = overrides
  return {
    fip: { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: overrides.rating, noseAromas, palateFlavors, finishNotes },
    ...rest,
  }
}

describe('buildBottleTastingSummary', () => {
  it('returns undefined for a bottle with no rating, take fields, or pours at all — never a hollow object', () => {
    expect(buildBottleTastingSummary(bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed' }), [])).toBeUndefined()
  })

  it('falls back to the bottle’s own settled rating when no pour has been logged yet', () => {
    const take = buildBottleTastingSummary(bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed', rating: 8.0 }), [])
    expect(take?.score).toBe(8.0)
    expect(take?.pourCount).toBe(0)
    expect(take?.latestTake).toBeUndefined()
    expect(take?.averageScore).toBeUndefined()
  })

  describe('one pour', () => {
    it('uses that single pour’s own detailed tasting information, with no average and no "based on" framing needed', () => {
      const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
      const pours = [
        pour({
          id: 'p1',
          bottleId: 'b1',
          date: '2026-01-01',
          rating: 9.3,
          memory: 'Rich and sweet.',
          noseAromas: ['Caramel', 'Vanilla'],
          palateFlavors: ['Cherry', 'Oak'],
          finishNotes: 'Long and warm with a little spicy heat.',
        }),
      ]

      const take = buildBottleTastingSummary(b, pours)
      expect(take?.score).toBe(9.3)
      expect(take?.pourCount).toBe(1)
      expect(take?.averageScore).toBeUndefined()
      expect(take?.noseNotes).toEqual(['Caramel', 'Vanilla'])
      expect(take?.palateNotes).toEqual(['Cherry', 'Oak'])
      expect(take?.finishNotes).toEqual(expect.arrayContaining(['long', 'warm', 'spicy']))
      expect(take?.topNotes).toEqual(expect.arrayContaining(['Caramel', 'Vanilla', 'Cherry', 'Oak']))
    })
  })

  describe('only real categories with data appear — never an empty label', () => {
    it('omits finishNotes entirely when no descriptor word appears in any pour’s free text', () => {
      const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
      const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0, noseAromas: ['Caramel'], finishNotes: 'Interesting.' })]
      const take = buildBottleTastingSummary(b, pours)
      expect(take?.finishNotes).toBeUndefined()
      expect(take?.noseNotes).toEqual(['Caramel'])
    })

    it('omits palateNotes entirely when no pour recorded any palate flavors', () => {
      const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
      const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0, noseAromas: ['Caramel'] })]
      const take = buildBottleTastingSummary(b, pours)
      expect(take?.palateNotes).toBeUndefined()
    })
  })

  describe('repeated notes rank higher than one-off notes', () => {
    it('ranks a note mentioned in every pour above one mentioned only once', () => {
      const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
      const pours = [
        pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0, palateFlavors: ['Oak', 'Cinnamon'] }),
        pour({ id: 'p2', bottleId: 'b1', date: '2026-02-01', rating: 8.5, palateFlavors: ['Oak'] }),
        pour({ id: 'p3', bottleId: 'b1', date: '2026-03-01', rating: 9.0, palateFlavors: ['Oak'] }),
      ]
      const take = buildBottleTastingSummary(b, pours)
      // Oak (3 mentions) ranks above Cinnamon (1 mention).
      expect(take?.palateNotes?.[0]).toBe('Oak')
    })

    it('lets a strong long-term pattern survive a single recent unusual note, rather than being erased by it', () => {
      const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
      const pours = [
        pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p2', bottleId: 'b1', date: '2026-02-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p3', bottleId: 'b1', date: '2026-03-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p4', bottleId: 'b1', date: '2026-04-01', rating: 8.0, palateFlavors: ['Oak'] }),
        // One recent, unusual note — should not outrank Oak's four mentions
        // even with the recency bonus.
        pour({ id: 'p5', bottleId: 'b1', date: '2026-05-01', rating: 8.0, palateFlavors: ['Mint'] }),
      ]
      const take = buildBottleTastingSummary(b, pours)
      expect(take?.palateNotes?.[0]).toBe('Oak')
    })
  })

  it('computes a real average score once there are 2+ pours, rounded to one decimal', () => {
    const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0 }),
      pour({ id: 'p2', bottleId: 'b1', date: '2026-02-01', rating: 9.0 }),
      pour({ id: 'p3', bottleId: 'b1', date: '2026-03-01', rating: 9.5 }),
    ]
    const take = buildBottleTastingSummary(b, pours)
    expect(take?.averageScore).toBeCloseTo(8.8, 5)
  })

  it('uses the latest pour’s date and score, not an arbitrary one', () => {
    const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
    const pours = [
      pour({ id: 'p1', bottleId: 'b1', date: '2026-03-01', rating: 9.0 }),
      pour({ id: 'p2', bottleId: 'b1', date: '2026-01-01', rating: 8.0 }),
    ]
    const take = buildBottleTastingSummary(b, pours)
    expect(take?.score).toBe(9.0)
    expect(take?.lastPourDate).toBe('2026-03-01')
  })

  it('caps combined top notes at 6, ranked by weighted frequency across nose and palate', () => {
    const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
    const pours = [
      pour({
        id: 'p1',
        bottleId: 'b1',
        date: '2026-01-01',
        rating: 8.0,
        noseAromas: ['Caramel', 'Vanilla', 'Honey'],
        palateFlavors: ['Cherry', 'Oak', 'Brown Sugar', 'Leather'],
      }),
    ]
    const take = buildBottleTastingSummary(b, pours)
    expect(take?.topNotes?.length).toBeLessThanOrEqual(6)
  })

  describe('bottle evolution insight', () => {
    it('stays silent below 4 pours — insufficient data to claim a trend', () => {
      const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
      const pours = [
        pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0, palateFlavors: ['Fruit'] }),
        pour({ id: 'p2', bottleId: 'b1', date: '2026-02-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p3', bottleId: 'b1', date: '2026-03-01', rating: 8.0, palateFlavors: ['Oak'] }),
      ]
      expect(buildBottleTastingSummary(b, pours)?.evolvingTerm).toBeUndefined()
    })

    it('surfaces a term whose presence clearly jumped in the most recent 3 pours vs. before', () => {
      const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
      const pours = [
        pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0, palateFlavors: ['Fruit'] }),
        pour({ id: 'p2', bottleId: 'b1', date: '2026-02-01', rating: 8.0, palateFlavors: ['Fruit'] }),
        pour({ id: 'p3', bottleId: 'b1', date: '2026-03-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p4', bottleId: 'b1', date: '2026-04-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p5', bottleId: 'b1', date: '2026-05-01', rating: 8.0, palateFlavors: ['Oak'] }),
      ]
      expect(buildBottleTastingSummary(b, pours)?.evolvingTerm).toBe('Oak')
    })

    it('stays silent when nothing shifts meaningfully, even with 4+ pours', () => {
      const b = bottle({ id: 'b1', name: 'Eagle Rare', status: 'open' })
      const pours = [
        pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p2', bottleId: 'b1', date: '2026-02-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p3', bottleId: 'b1', date: '2026-03-01', rating: 8.0, palateFlavors: ['Oak'] }),
        pour({ id: 'p4', bottleId: 'b1', date: '2026-04-01', rating: 8.0, palateFlavors: ['Oak'] }),
      ]
      expect(buildBottleTastingSummary(b, pours)?.evolvingTerm).toBeUndefined()
    })
  })

  it('never surfaces private bottle fields (price, store, purchase date, personal notes) through the take', () => {
    const b = bottle({
      id: 'b1',
      name: 'Eagle Rare',
      status: 'open',
      price: 45,
      storeLocation: 'Total Wine',
      purchaseDate: '2026-01-01',
      notes: 'Private bottle-level note',
    })
    const take = buildBottleTastingSummary(b, [pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.0 })]) as unknown as Record<
      string,
      unknown
    >
    expect(take.price).toBeUndefined()
    expect(take.storeLocation).toBeUndefined()
    expect(take.purchaseDate).toBeUndefined()
    expect(take.notes).toBeUndefined()
  })
})
