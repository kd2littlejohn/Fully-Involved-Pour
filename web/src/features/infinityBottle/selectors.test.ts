import { describe, expect, it } from 'vitest'
import {
  averageScore,
  batchComposition,
  batchDisplayName,
  batchVolumeMl,
  currentBatch,
  currentScore,
  displayBatch,
  estimatedProof,
  latestTasting,
  resolveAdditionSourceBottle,
  scoreEvolution,
  sortedTastings,
} from './selectors'
import type { Bottle, BlendAddition, InfinityBatch, InfinityBottle, InfinityTasting } from '../../data/types'

function addition(overrides: Partial<BlendAddition> & Pick<BlendAddition, 'id' | 'amountMl'>): BlendAddition {
  return { bottleName: 'Test Bottle', date: '2026-01-01', createdAt: 1, ...overrides }
}

function tasting(overrides: Partial<InfinityTasting> & Pick<InfinityTasting, 'id' | 'date' | 'score'>): InfinityTasting {
  return { noseAromas: [], palateFlavors: [], createdAt: 1, ...overrides }
}

function batch(overrides: Partial<InfinityBatch> = {}): InfinityBatch {
  return { id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [], ...overrides }
}

function ib(overrides: Partial<InfinityBottle> = {}): InfinityBottle {
  return { id: 'ib1', name: 'Test Vessel', archived: false, createdAt: 1, batches: [batch()], ...overrides }
}

describe('currentBatch / displayBatch', () => {
  it('currentBatch returns the last batch when the vessel is not archived', () => {
    const vessel = ib({ batches: [batch({ id: 'b1' }), batch({ id: 'b2' })] })
    expect(currentBatch(vessel)?.id).toBe('b2')
  })

  it('currentBatch returns undefined when the vessel is archived', () => {
    const vessel = ib({ archived: true, batches: [batch({ id: 'b1' })] })
    expect(currentBatch(vessel)).toBeUndefined()
  })

  it('displayBatch always returns the most recent batch, archived or not', () => {
    const vessel = ib({ archived: true, batches: [batch({ id: 'b1' }), batch({ id: 'b2' })] })
    expect(displayBatch(vessel)?.id).toBe('b2')
  })
})

describe('batchDisplayName', () => {
  it('uses the vessel name alone when the batch has no name', () => {
    expect(batchDisplayName(ib({ name: 'Backdraft Batch' }), batch())).toBe('Backdraft Batch')
  })

  it('combines vessel and batch name when the batch has one', () => {
    expect(batchDisplayName(ib({ name: 'Backdraft Batch' }), batch({ name: 'First Due' }))).toBe('Backdraft Batch - First Due')
  })
})

describe('batchVolumeMl', () => {
  it('sums every addition amount', () => {
    const b = batch({ additions: [addition({ id: 'a1', amountMl: 60 }), addition({ id: 'a2', amountMl: 40 })] })
    expect(batchVolumeMl(b)).toBe(100)
  })

  it('is zero for an empty batch', () => {
    expect(batchVolumeMl(batch())).toBe(0)
  })
})

describe('batchComposition', () => {
  it('groups additions of the same bottle into one slice and computes percentages', () => {
    const b = batch({
      additions: [
        addition({ id: 'a1', sourceBottleId: 'src1', bottleName: 'Eagle Rare', amountMl: 60 }),
        addition({ id: 'a2', sourceBottleId: 'src1', bottleName: 'Eagle Rare', amountMl: 40 }),
        addition({ id: 'a3', sourceBottleId: 'src2', bottleName: 'Weller 12', amountMl: 100 }),
      ],
    })
    const composition = batchComposition(b)
    expect(composition).toHaveLength(2)
    const eagleSlice = composition.find((s) => s.name === 'Eagle Rare')
    expect(eagleSlice?.ml).toBe(100)
    expect(eagleSlice?.percent).toBe(50)
    expect(composition.find((s) => s.name === 'Weller 12')?.percent).toBe(50)
  })

  it('sorts largest slice first', () => {
    const b = batch({
      additions: [
        addition({ id: 'a1', sourceBottleId: 'src1', bottleName: 'Small', amountMl: 10 }),
        addition({ id: 'a2', sourceBottleId: 'src2', bottleName: 'Big', amountMl: 90 }),
      ],
    })
    expect(batchComposition(b).map((s) => s.name)).toEqual(['Big', 'Small'])
  })

  it('prefers canonicalBottleId over sourceBottleId for grouping when both are present', () => {
    const b = batch({
      additions: [
        addition({ id: 'a1', sourceBottleId: 'src1', canonicalBottleId: 'canon1', bottleName: 'Eagle Rare', amountMl: 60 }),
        addition({ id: 'a2', sourceBottleId: 'src2', canonicalBottleId: 'canon1', bottleName: 'Eagle Rare', amountMl: 40 }),
      ],
    })
    expect(batchComposition(b)).toHaveLength(1)
  })

  it('drops the linkable sourceBottleId once a canonical-bottle slice combines additions from two different source-bottle records (e.g. bought twice)', () => {
    const b = batch({
      additions: [
        addition({ id: 'a1', sourceBottleId: 'src1', canonicalBottleId: 'canon1', bottleName: 'Eagle Rare', amountMl: 60 }),
        addition({ id: 'a2', sourceBottleId: 'src2', canonicalBottleId: 'canon1', bottleName: 'Eagle Rare', amountMl: 40 }),
      ],
    })
    expect(batchComposition(b)[0]?.sourceBottleId).toBeUndefined()
  })

  it('returns an empty array for an empty batch', () => {
    expect(batchComposition(batch())).toEqual([])
  })
})

describe('estimatedProof', () => {
  it('computes the volume-weighted average when every addition has a proof', () => {
    const b = batch({
      additions: [addition({ id: 'a1', amountMl: 50, proof: 90 }), addition({ id: 'a2', amountMl: 50, proof: 100 })],
    })
    expect(estimatedProof(b)).toBe(95)
  })

  it('is undefined when the batch has no additions', () => {
    expect(estimatedProof(batch())).toBeUndefined()
  })

  // The explicit, approved rule: never a partial/subset average.
  it('is undefined — not a partial average — when even one contributing addition lacks a proof', () => {
    const b = batch({
      additions: [addition({ id: 'a1', amountMl: 50, proof: 90 }), addition({ id: 'a2', amountMl: 50 })],
    })
    expect(estimatedProof(b)).toBeUndefined()
  })

  it('ignores a zero-amount addition missing proof (nothing it could contribute) but still requires proof on every real contributor', () => {
    const b = batch({
      additions: [addition({ id: 'a1', amountMl: 50, proof: 90 }), addition({ id: 'a2', amountMl: 0 })],
    })
    expect(estimatedProof(b)).toBe(90)
  })
})

describe('scores', () => {
  it('sortedTastings orders chronologically by date', () => {
    const b = batch({
      tastings: [tasting({ id: 't2', date: '2026-02-01', score: 8 }), tasting({ id: 't1', date: '2026-01-01', score: 7 })],
    })
    expect(sortedTastings(b).map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('latestTasting / currentScore reflect the most recent tasting by date', () => {
    const b = batch({
      tastings: [tasting({ id: 't1', date: '2026-01-01', score: 7 }), tasting({ id: 't2', date: '2026-02-01', score: 8.5 })],
    })
    expect(latestTasting(b)?.id).toBe('t2')
    expect(currentScore(b)).toBe(8.5)
  })

  it('currentScore is undefined with no tastings', () => {
    expect(currentScore(batch())).toBeUndefined()
  })

  it('averageScore averages every tasting', () => {
    const b = batch({ tastings: [tasting({ id: 't1', date: '2026-01-01', score: 6 }), tasting({ id: 't2', date: '2026-01-02', score: 8 })] })
    expect(averageScore(b)).toBe(7)
  })

  it('scoreEvolution returns chronological {date, score} points', () => {
    const b = batch({
      tastings: [tasting({ id: 't2', date: '2026-02-01', score: 8 }), tasting({ id: 't1', date: '2026-01-01', score: 7 })],
    })
    expect(scoreEvolution(b)).toEqual([
      { date: '2026-01-01', score: 7 },
      { date: '2026-02-01', score: 8 },
    ])
  })
})

describe('resolveAdditionSourceBottle', () => {
  const bottles: Bottle[] = [{ id: 'src1', name: 'Eagle Rare', status: 'open' }]

  it('resolves a live bottle by id', () => {
    expect(resolveAdditionSourceBottle(bottles, 'src1')?.name).toBe('Eagle Rare')
  })

  it('returns undefined when the source bottle no longer exists', () => {
    expect(resolveAdditionSourceBottle(bottles, 'deleted-id')).toBeUndefined()
  })

  it('returns undefined when there is no sourceBottleId at all', () => {
    expect(resolveAdditionSourceBottle(bottles, undefined)).toBeUndefined()
  })
})
