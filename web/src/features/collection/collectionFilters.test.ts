import { describe, expect, it } from 'vitest'
import { matchesFilter } from './collectionFilters'
import type { Bottle } from '../../data/types'

const base: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }

describe('matchesFilter', () => {
  it('matches every bottle under "all"', () => {
    expect(matchesFilter(base, 'all', [], new Set())).toBe(true)
  })

  it('matches status filters directly', () => {
    expect(matchesFilter({ ...base, status: 'sealed' }, 'sealed', [], new Set())).toBe(true)
    expect(matchesFilter({ ...base, status: 'sealed' }, 'open', [], new Set())).toBe(false)
  })

  it('matches favorites', () => {
    expect(matchesFilter({ ...base, favorite: true }, 'favorites', [], new Set())).toBe(true)
    expect(matchesFilter({ ...base, favorite: false }, 'favorites', [], new Set())).toBe(false)
  })

  it('always excludes core-bar — computed separately by the caller', () => {
    expect(matchesFilter(base, 'core-bar', [], new Set())).toBe(false)
  })

  it('matches low-fill through isLowFill', () => {
    expect(matchesFilter({ ...base, fillLevel: 'empty' }, 'low-fill', [], new Set())).toBe(true)
    expect(matchesFilter({ ...base, fillLevel: 'full' }, 'low-fill', [], new Set())).toBe(false)
  })

  it('matches rare-unicorn through isRareOrUnicorn', () => {
    expect(matchesFilter({ ...base, rarity: 'rare', raritySource: 'manual' }, 'rare-unicorn', [], new Set())).toBe(true)
    expect(matchesFilter({ ...base, rarity: 'common', raritySource: 'manual' }, 'rare-unicorn', [], new Set())).toBe(false)
  })

  it('matches needs-replacement through wouldReplace', () => {
    expect(matchesFilter({ ...base, wouldReplace: 'yes' }, 'needs-replacement', [], new Set())).toBe(true)
    expect(matchesFilter(base, 'needs-replacement', [], new Set())).toBe(false)
  })

  it('matches never-reviewed for an owned bottle with no rating', () => {
    expect(matchesFilter(base, 'never-reviewed', [], new Set())).toBe(true)
    expect(matchesFilter({ ...base, rating: 8 }, 'never-reviewed', [], new Set())).toBe(false)
  })

  it('matches not-poured-recently for a never-poured open bottle', () => {
    expect(matchesFilter(base, 'not-poured-recently', [], new Set())).toBe(true)
    expect(matchesFilter({ ...base, status: 'sealed' }, 'not-poured-recently', [], new Set())).toBe(false)
  })

  it('matches duplicates through quantity', () => {
    expect(matchesFilter({ ...base, quantity: 2 }, 'duplicates', [], new Set())).toBe(true)
    expect(matchesFilter(base, 'duplicates', [], new Set())).toBe(false)
  })

  it('matches infinity-ingredients through the provided id set', () => {
    expect(matchesFilter(base, 'infinity-ingredients', [], new Set(['b1']))).toBe(true)
    expect(matchesFilter(base, 'infinity-ingredients', [], new Set(['other']))).toBe(false)
  })
})
