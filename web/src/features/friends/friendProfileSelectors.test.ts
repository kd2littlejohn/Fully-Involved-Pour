import { describe, expect, it } from 'vitest'
import { getBottlesInCommon, findMyMatchingBottle } from './friendProfileSelectors'
import type { Bottle } from '../../data/types'

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'name' | 'status'>): Bottle {
  return { id: `${overrides.name}-${overrides.distillery ?? ''}`, ...overrides }
}

describe('getBottlesInCommon', () => {
  it('matches bottles by name + distillery, case-insensitively', () => {
    const mine = [bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' })]
    const friends = [{ id: 'f1', name: 'eagle rare', distillery: 'buffalo trace', status: 'open' as const }]
    expect(getBottlesInCommon(mine, friends)).toEqual([
      { name: 'Eagle Rare', distillery: 'Buffalo Trace', imageUrl: undefined, type: undefined, proof: undefined, ageStatement: undefined, status: 'open' },
    ])
  })

  it('excludes bottles only on my wishlist', () => {
    const mine = [bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'wishlist' })]
    const friends = [{ id: 'f1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' as const }]
    expect(getBottlesInCommon(mine, friends)).toEqual([])
  })

  it('never fabricates a match when distillery differs', () => {
    const mine = [bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' })]
    const friends = [{ id: 'f1', name: 'Eagle Rare', distillery: 'Some Other Distillery', status: 'open' as const }]
    expect(getBottlesInCommon(mine, friends)).toEqual([])
  })

  it('deduplicates repeated bottles on my side', () => {
    const mine = [
      bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' }),
      bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' }),
    ]
    const friends = [{ id: 'f1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' as const }]
    expect(getBottlesInCommon(mine, friends)).toHaveLength(1)
  })

  it('carries the viewer’s own type/proof/age/status detail through, not the friend’s projection', () => {
    const mine = [bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'sealed', type: 'Bourbon', proof: 90, ageStatement: '10 Year' })]
    const friends = [{ id: 'f1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' as const, type: 'Rye', proof: 100 }]
    expect(getBottlesInCommon(mine, friends)).toEqual([
      {
        name: 'Eagle Rare',
        distillery: 'Buffalo Trace',
        imageUrl: undefined,
        type: 'Bourbon',
        proof: 90,
        ageStatement: '10 Year',
        status: 'sealed',
      },
    ])
  })
})

describe('findMyMatchingBottle', () => {
  it('finds a match by name + distillery, case-insensitively, regardless of status', () => {
    const mine = [bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'wishlist' })]
    expect(findMyMatchingBottle(mine, 'eagle rare', 'buffalo trace')?.status).toBe('wishlist')
  })

  it('returns undefined when nothing matches', () => {
    const mine = [bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' })]
    expect(findMyMatchingBottle(mine, 'Weller 12', 'Buffalo Trace')).toBeUndefined()
  })

  it('never fabricates a match when distillery differs', () => {
    const mine = [bottle({ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' })]
    expect(findMyMatchingBottle(mine, 'Eagle Rare', 'Some Other Distillery')).toBeUndefined()
  })
})
