import { describe, expect, it } from 'vitest'
import { buildSavedTastings, matchMyBarBottle, savedTastingId } from './savedTastings'
import { makeCategory, makeParty, makeResults } from './__fixtures__/party'
import type { PartyBallot } from './types'
import type { Bottle } from '../../data/types'

function ballot(overrides: Partial<PartyBallot> = {}): PartyBallot {
  return {
    id: 'c1__g1',
    partyId: 'p1',
    categoryId: 'c1',
    participantKey: 'g1',
    source: 'digital',
    ownerUid: 'u1',
    mode: 'detailed',
    scores: {
      A: { overall: 8.5, nose: 8, palate: 9, notes: '  Cherry and oak  ', descriptors: ['Cherry', 'Oak'] },
      B: { overall: 6 },
    },
    favoriteLabel: 'A',
    predictionLabel: null,
    excluded: false,
    createdAt: 1,
    updatedAt: 1,
    revision: 1,
    ...overrides,
  }
}

const revealed = makeCategory({ state: 'revealed', votingOpenedAt: Date.UTC(2026, 9, 10, 23), revealedAt: Date.UTC(2026, 9, 11, 1) })
const myBar: Bottle[] = [{ id: 'bar-larceny', name: 'LARCENY', status: 'open' }]

describe('buildSavedTastings', () => {
  it('saves each scored sample of a revealed blind round with its bottle, event, scores, notes and descriptors', () => {
    const entries = buildSavedTastings({ party: makeParty(), category: revealed, results: makeResults(), ballot: ballot(), myBar, now: 99 })
    expect(entries).toHaveLength(2)
    const larceny = entries.find((e) => e.label === 'A')!
    expect(larceny).toMatchObject({
      id: savedTastingId('p1', 'c1', 'A'),
      source: 'party',
      format: 'blind',
      eventName: 'Bourbon Night',
      categoryName: 'Wheated Bourbon',
      bottle: { name: 'Larceny' },
      bottleId: 'bar-larceny',
      overall: 8.5,
      nose: 8,
      palate: 9,
      notes: 'Cherry and oak',
      descriptors: ['Cherry', 'Oak'],
      favorite: true,
      revealedAt: revealed.revealedAt,
      savedAt: 99,
    })
    // The tasting date is when it was tasted, not when it's saved.
    expect(larceny.date).toMatch(/^2026-10-1[01]$/)
    expect(entries.find((e) => e.label === 'B')).toMatchObject({ bottle: { name: 'Weller 12' }, overall: 6, favorite: false, descriptors: [] })
    expect(entries.find((e) => e.label === 'B')!.bottleId).toBeUndefined()
    // Unscored sample C is skipped.
    expect(entries.find((e) => e.label === 'C')).toBeUndefined()
  })

  it('never saves before the bottles are known', () => {
    expect(
      buildSavedTastings({ party: makeParty(), category: makeCategory({ state: 'voting_closed' }), results: makeResults(), ballot: ballot(), myBar }),
    ).toEqual([])
    expect(buildSavedTastings({ party: makeParty(), category: revealed, results: undefined, ballot: ballot(), myBar })).toEqual([])
    expect(buildSavedTastings({ party: makeParty(), category: revealed, results: makeResults(), ballot: undefined, myBar })).toEqual([])
  })

  it('keeps the origin and integrity: regular tastings have no reveal, a host’s unblinded ballot is marked', () => {
    const regular = buildSavedTastings({ party: makeParty({ format: 'regular' }), category: revealed, results: makeResults(), ballot: ballot(), myBar })
    expect(regular[0]).toMatchObject({ format: 'regular' })
    expect(regular[0]!.revealedAt).toBeUndefined()
    const host = buildSavedTastings({ party: makeParty(), category: revealed, results: makeResults(), ballot: ballot({ unblinded: true }), myBar })
    expect(host.every((e) => e.notFullyBlind)).toBe(true)
  })

  it('never carries the host’s price into a taster’s history', () => {
    const results = makeResults()
    results.samples[1] = { ...results.samples[1]!, bottle: { name: 'Larceny', price: 30 } as never }
    const entries = buildSavedTastings({ party: makeParty(), category: revealed, results, ballot: ballot(), myBar })
    expect(JSON.stringify(entries)).not.toContain('price')
  })

  it('uses the same id for the same sample, so saving twice can’t duplicate', () => {
    const a = buildSavedTastings({ party: makeParty(), category: revealed, results: makeResults(), ballot: ballot(), myBar, now: 1 })
    const b = buildSavedTastings({ party: makeParty(), category: revealed, results: makeResults(), ballot: ballot(), myBar, now: 2 })
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id))
  })
})

describe('matchMyBarBottle', () => {
  it('matches by name ignoring case and spacing, preferring bottles you have over wishlist', () => {
    const bar: Bottle[] = [
      { id: 'w', name: "Blanton's", status: 'wishlist' },
      { id: 'o', name: 'blantons', status: 'open' },
    ]
    expect(matchMyBarBottle("Blanton's", bar)?.id).toBe('w')
    expect(matchMyBarBottle('BLANTONS', bar)?.id).toBe('o')
    expect(matchMyBarBottle('Weller', bar)).toBeUndefined()
  })
})
