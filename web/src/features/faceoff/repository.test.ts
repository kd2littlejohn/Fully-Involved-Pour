import { describe, expect, it } from 'vitest'
import { faceoffPairKey } from './repository'

describe('faceoffPairKey', () => {
  it('is order-independent so both pairings resolve to the same key', () => {
    expect(faceoffPairKey('Eagle Rare', 'Weller 12')).toBe(faceoffPairKey('Weller 12', 'Eagle Rare'))
  })

  it('normalizes case and spacing', () => {
    expect(faceoffPairKey('Eagle Rare', 'Weller 12')).toBe('eagle-rare__weller-12')
  })
})
