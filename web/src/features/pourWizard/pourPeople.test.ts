import { describe, expect, it } from 'vitest'
import type { Pour, PourPerson } from '../../data/types'
import { normalizePersonName, findMatchingPerson, parseLegacyCompanion, resolvePouredWith, companionStringFromPouredWith } from './pourPeople'

function person(overrides: Partial<PourPerson> & Pick<PourPerson, 'id' | 'name'>): PourPerson {
  return { normalizedName: normalizePersonName(overrides.name), createdAt: 1, ...overrides }
}

describe('normalizePersonName', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizePersonName('  Marcus  ')).toBe('marcus')
    expect(normalizePersonName('Kevin   Littlejohn')).toBe('kevin littlejohn')
    expect(normalizePersonName('MARCUS')).toBe('marcus')
  })
})

describe('findMatchingPerson', () => {
  const marcus = person({ id: 'p1', name: 'Marcus' })

  it('matches despite capitalization/spacing differences', () => {
    expect(findMatchingPerson([marcus], '  marcus ')).toBe(marcus)
    expect(findMatchingPerson([marcus], 'MARCUS')).toBe(marcus)
  })

  it('returns undefined when nothing matches', () => {
    expect(findMatchingPerson([marcus], 'Chris')).toBeUndefined()
  })

  it('returns undefined for an empty/whitespace-only name', () => {
    expect(findMatchingPerson([marcus], '   ')).toBeUndefined()
  })
})

describe('parseLegacyCompanion', () => {
  it('returns an empty array for undefined or empty input', () => {
    expect(parseLegacyCompanion(undefined)).toEqual([])
    expect(parseLegacyCompanion('')).toEqual([])
  })

  it('splits a comma-joined string into individual name refs', () => {
    expect(parseLegacyCompanion('Marcus, Chris')).toEqual([{ name: 'Marcus' }, { name: 'Chris' }])
  })

  it('trims whitespace and drops empty segments (e.g. a trailing comma)', () => {
    expect(parseLegacyCompanion('Marcus,  , Chris, ')).toEqual([{ name: 'Marcus' }, { name: 'Chris' }])
  })
})

describe('resolvePouredWith', () => {
  const marcus = person({ id: 'p1', name: 'Marcus', photoUrl: 'https://example.com/marcus.jpg' })

  it('derives from the legacy companion string when pouredWith is absent', () => {
    const pour: Pick<Pour, 'pouredWith' | 'companion'> = { companion: 'Marcus, Chris' }
    expect(resolvePouredWith(pour, [])).toEqual([{ name: 'Marcus' }, { name: 'Chris' }])
  })

  it('re-links a legacy name to an existing saved person by normalized match, surfacing their real avatar', () => {
    const pour: Pick<Pour, 'pouredWith' | 'companion'> = { companion: 'marcus' }
    expect(resolvePouredWith(pour, [marcus])).toEqual([{ personId: 'p1', name: 'Marcus' }])
  })

  it('leaves a legacy name unlinked when no saved person matches', () => {
    const pour: Pick<Pour, 'pouredWith' | 'companion'> = { companion: 'Someone New' }
    expect(resolvePouredWith(pour, [marcus])).toEqual([{ name: 'Someone New' }])
  })

  it('prefers the structured pouredWith field when present, ignoring companion entirely', () => {
    const pour: Pick<Pour, 'pouredWith' | 'companion'> = {
      pouredWith: [{ personId: 'p1', name: 'Marcus' }],
      companion: 'This should be ignored',
    }
    expect(resolvePouredWith(pour, [marcus])).toEqual([{ personId: 'p1', name: 'Marcus' }])
  })

  it('re-resolves an unlinked structured ref against people that exist now', () => {
    const pour: Pick<Pour, 'pouredWith' | 'companion'> = { pouredWith: [{ name: 'Marcus' }] }
    expect(resolvePouredWith(pour, [marcus])).toEqual([{ personId: 'p1', name: 'Marcus' }])
  })

  it('returns an empty array when there is nothing to resolve', () => {
    expect(resolvePouredWith({}, [marcus])).toEqual([])
  })
})

describe('companionStringFromPouredWith', () => {
  it('joins names with a comma', () => {
    expect(companionStringFromPouredWith([{ name: 'Marcus' }, { personId: 'p2', name: 'Chris' }])).toBe('Marcus, Chris')
  })

  it('returns undefined for an empty list, never an empty string', () => {
    expect(companionStringFromPouredWith([])).toBeUndefined()
  })

  it('filters out blank names', () => {
    expect(companionStringFromPouredWith([{ name: 'Marcus' }, { name: '  ' }])).toBe('Marcus')
  })
})
