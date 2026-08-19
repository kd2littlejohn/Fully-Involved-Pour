import { describe, expect, it } from 'vitest'
import { getBottlesInCommon } from './friendProfileSelectors'

describe('getBottlesInCommon', () => {
  it('matches bottles by name + distillery, case-insensitively', () => {
    const mine = [{ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' }]
    const friends = [{ id: 'f1', name: 'eagle rare', distillery: 'buffalo trace', status: 'open' as const }]
    expect(getBottlesInCommon(mine, friends)).toEqual([{ name: 'Eagle Rare', distillery: 'Buffalo Trace', imageUrl: undefined }])
  })

  it('excludes bottles only on my wishlist', () => {
    const mine = [{ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'wishlist' }]
    const friends = [{ id: 'f1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' as const }]
    expect(getBottlesInCommon(mine, friends)).toEqual([])
  })

  it('never fabricates a match when distillery differs', () => {
    const mine = [{ name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' }]
    const friends = [{ id: 'f1', name: 'Eagle Rare', distillery: 'Some Other Distillery', status: 'open' as const }]
    expect(getBottlesInCommon(mine, friends)).toEqual([])
  })

  it('deduplicates repeated bottles on my side', () => {
    const mine = [
      { name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' },
      { name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' },
    ]
    const friends = [{ id: 'f1', name: 'Eagle Rare', distillery: 'Buffalo Trace', status: 'open' as const }]
    expect(getBottlesInCommon(mine, friends)).toHaveLength(1)
  })
})
