import { describe, expect, it } from 'vitest'
import { normalizeInfinityBottle, normalizeInfinityBottles } from './migrateInfinityBottle'

describe('normalizeInfinityBottle — legacy records', () => {
  it('converts a legacy flat-additions record into a single initial active batch, flagging migrated: true', () => {
    const legacy = {
      id: 'abc',
      name: 'Backdraft Batch',
      notes: 'started with leftovers',
      additions: [
        { bottleId: 'src1', name: 'Eagle Rare 10 Year', amount: '2 oz', date: '2025-01-01' },
        { bottleId: 'src2', name: 'Weller Special Reserve', amount: '60ml', date: '2025-02-01' },
      ],
    }

    const { bottle, migrated } = normalizeInfinityBottle(legacy)

    expect(migrated).toBe(true)
    expect(bottle.id).toBe('abc')
    expect(bottle.name).toBe('Backdraft Batch')
    expect(bottle.archived).toBe(false)
    expect(typeof bottle.createdAt).toBe('number')
    expect(bottle.batches).toHaveLength(1)

    const batch = bottle.batches[0]!
    expect(batch.status).toBe('active')
    expect(batch.name).toBe('Batch 1')
    expect(batch.tastings).toEqual([])
    expect(batch.additions).toHaveLength(2)
  })

  it('preserves every legacy addition field: source bottle, amount, date, note', () => {
    const legacy = {
      id: 'abc',
      name: 'Backdraft Batch',
      additions: [{ bottleId: 'src1', name: 'Eagle Rare 10 Year', amount: '2 oz', date: '2025-01-01' }],
    }
    const { bottle } = normalizeInfinityBottle(legacy)
    const addition = bottle.batches[0]!.additions[0]!

    expect(addition.sourceBottleId).toBe('src1')
    expect(addition.bottleName).toBe('Eagle Rare 10 Year')
    expect(addition.date).toBe('2025-01-01')
    // "2 oz" unambiguously parses (number + known unit) — converted, not guessed.
    expect(addition.amountMl).toBe(Math.round(2 * 29.5735))
    // Legacy schema never captured proof — never fabricated.
    expect(addition.proof).toBeUndefined()
    expect(typeof addition.id).toBe('string')
    expect(addition.id.length).toBeGreaterThan(0)
  })

  it('parses a plain ml amount with no unit suffix as ml', () => {
    const legacy = { id: 'abc', name: 'X', additions: [{ name: 'Bottle', amount: '90' }] }
    const { bottle } = normalizeInfinityBottle(legacy)
    expect(bottle.batches[0]!.additions[0]!.amountMl).toBe(90)
  })

  it('never fabricates a number from ambiguous free-text amount — preserves the text as a note instead', () => {
    const legacy = { id: 'abc', name: 'X', additions: [{ name: 'Bottle', amount: 'a splash' }] }
    const { bottle } = normalizeInfinityBottle(legacy)
    const addition = bottle.batches[0]!.additions[0]!
    expect(addition.amountMl).toBe(0)
    expect(addition.note).toBe('Legacy amount: a splash')
  })

  it('handles a legacy record with an empty additions array', () => {
    const legacy = { id: 'abc', name: 'Empty Blend', additions: [] }
    const { bottle, migrated } = normalizeInfinityBottle(legacy)
    expect(migrated).toBe(true)
    expect(bottle.batches).toHaveLength(1)
    expect(bottle.batches[0]!.additions).toEqual([])
  })

  it('handles a legacy record with additions entirely missing (not even an empty array)', () => {
    const legacy = { id: 'abc', name: 'No Additions Field' }
    const { bottle, migrated } = normalizeInfinityBottle(legacy)
    expect(migrated).toBe(true)
    expect(bottle.batches[0]!.additions).toEqual([])
  })

  it('falls back to "Unknown Bottle" when a legacy addition has no name', () => {
    const legacy = { id: 'abc', name: 'X', additions: [{ amount: '30ml' }] }
    const { bottle } = normalizeInfinityBottle(legacy)
    expect(bottle.batches[0]!.additions[0]!.bottleName).toBe('Unknown Bottle')
  })
})

describe('normalizeInfinityBottle — already new-format records', () => {
  it('leaves a valid new-format record untouched and flags migrated: false', () => {
    const modern = {
      id: 'ib1',
      name: 'House Blend',
      archived: false,
      createdAt: 12345,
      batches: [
        { id: 'b1', status: 'active' as const, startedAt: 1, additions: [], tastings: [] },
      ],
    }
    const { bottle, migrated } = normalizeInfinityBottle(modern)
    expect(migrated).toBe(false)
    expect(bottle).toEqual(modern)
  })

  it('fills safe defaults for missing optional fields without flagging a migration write', () => {
    const sparse = {
      id: 'ib1',
      name: 'Sparse',
      batches: [{ id: 'b1', startedAt: 5 }],
      // archived, createdAt, capacityMl all missing
    }
    const { bottle, migrated } = normalizeInfinityBottle(sparse)
    expect(migrated).toBe(false)
    expect(bottle.archived).toBe(false)
    expect(typeof bottle.createdAt).toBe('number')
    expect(bottle.capacityMl).toBeUndefined()
    expect(bottle.batches[0]!.additions).toEqual([])
    expect(bottle.batches[0]!.tastings).toEqual([])
    expect(bottle.batches[0]!.status).toBe('active')
  })

  it('synthesizes one empty active batch when batches is present but empty', () => {
    const sparse = { id: 'ib1', name: 'Empty Batches', batches: [] }
    const { bottle, migrated } = normalizeInfinityBottle(sparse)
    expect(migrated).toBe(false)
    expect(bottle.batches).toHaveLength(1)
    expect(bottle.batches[0]!.additions).toEqual([])
  })

  it('tolerates a batch missing tastings/additions arrays entirely', () => {
    const sparse = { id: 'ib1', name: 'X', batches: [{ id: 'b1', status: 'complete' as const, startedAt: 1 }] }
    const { bottle } = normalizeInfinityBottle(sparse)
    expect(bottle.batches[0]!.additions).toEqual([])
    expect(bottle.batches[0]!.tastings).toEqual([])
    expect(bottle.batches[0]!.status).toBe('complete')
  })
})

describe('normalizeInfinityBottles — list + idempotency', () => {
  it('migrates only the legacy records in a mixed list, preserving the rest untouched', () => {
    const legacy = { id: 'legacy1', name: 'Old', additions: [{ name: 'A', amount: '30ml' }] }
    const modern = { id: 'modern1', name: 'New', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active' as const, startedAt: 1, additions: [], tastings: [] }] }

    const { infinityBottles, migrated } = normalizeInfinityBottles([legacy, modern])

    expect(migrated).toBe(true)
    expect(infinityBottles).toHaveLength(2)
    expect(infinityBottles[0]!.batches).toHaveLength(1)
    expect(infinityBottles[1]).toEqual(modern)
  })

  it('is a no-op (migrated: false) for a list that is already fully migrated', () => {
    const modern = { id: 'modern1', name: 'New', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active' as const, startedAt: 1, additions: [], tastings: [] }] }
    const { migrated } = normalizeInfinityBottles([modern])
    expect(migrated).toBe(false)
  })

  it('running normalization twice on its own output is idempotent — the second pass never reports migrated: true', () => {
    const legacy = { id: 'legacy1', name: 'Old', additions: [{ name: 'A', amount: '30ml' }] }
    const first = normalizeInfinityBottles([legacy])
    expect(first.migrated).toBe(true)

    const second = normalizeInfinityBottles(first.infinityBottles)
    expect(second.migrated).toBe(false)
    expect(second.infinityBottles).toEqual(first.infinityBottles)
  })

  it('handles a missing/non-array infinityBottles field without crashing', () => {
    expect(normalizeInfinityBottles(undefined)).toEqual({ infinityBottles: [], migrated: false })
  })

  it('a realistic multi-record production-style legacy doc migrates cleanly end to end', () => {
    const productionStyleLegacy = [
      {
        id: 'ib-prod-1',
        name: "Grandpa's Perpetual Blend",
        notes: 'Been going since 2022.',
        additions: [
          { bottleId: 'bt-1', name: 'Buffalo Trace', amount: '3 oz', date: '2024-03-01' },
          { bottleId: 'bt-2', name: 'Four Roses Small Batch', amount: '1.5oz', date: '2024-06-15' },
          { name: 'A mystery pour from a friend', date: '2024-09-01' },
        ],
      },
    ]

    const { infinityBottles, migrated } = normalizeInfinityBottles(productionStyleLegacy)
    expect(migrated).toBe(true)
    expect(infinityBottles).toHaveLength(1)
    const batch = infinityBottles[0]!.batches[0]!
    expect(batch.additions).toHaveLength(3)
    expect(batch.additions.map((a) => a.bottleName)).toEqual([
      'Buffalo Trace',
      'Four Roses Small Batch',
      'A mystery pour from a friend',
    ])
    expect(batch.additions[2]!.amountMl).toBe(0)
    expect(batch.additions[2]!.date).toBeTruthy()
  })
})
