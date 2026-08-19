import { describe, expect, it } from 'vitest'
import { bottleDistilleryMatches, distilleryToOption, getDistilleryById, resolveDistillery, searchDistilleries } from './search'

describe('searchDistilleries', () => {
  it('matches an official name', () => {
    const results = searchDistilleries('Buffalo Trace')
    expect(results.some((d) => d.name === 'Buffalo Trace Distillery')).toBe(true)
  })

  it('matches a well-known alias, not just the official name', () => {
    const results = searchDistilleries('BT')
    expect(results.some((d) => d.name === 'Buffalo Trace Distillery')).toBe(true)
  })

  it('matches "MGP" to Ross & Squibb Distillery', () => {
    const results = searchDistilleries('MGP')
    expect(results.some((d) => d.name === 'Ross & Squibb Distillery')).toBe(true)
  })

  it('matches "Jim Beam" to James B. Beam Distilling Co.', () => {
    const results = searchDistilleries('Jim Beam')
    expect(results.some((d) => d.name === 'James B. Beam Distilling Co.')).toBe(true)
  })

  it('matches "Wild Turkey" and "WT" to Wild Turkey Distilling Co.', () => {
    expect(searchDistilleries('Wild Turkey').some((d) => d.name === 'Wild Turkey Distilling Co.')).toBe(true)
    expect(searchDistilleries('WT').some((d) => d.name === 'Wild Turkey Distilling Co.')).toBe(true)
  })

  it('never returns Weller, Eagle Rare, E.H. Taylor, or Elijah Craig as their own distillery — brands stay out of this dataset', () => {
    for (const brand of ['Weller', 'Eagle Rare', 'E.H. Taylor', 'Elijah Craig', "Russell's Reserve"]) {
      expect(searchDistilleries(brand)).toEqual([])
    }
  })

  it('returns the sourcing placeholders by default when the query is empty', () => {
    const results = searchDistilleries('')
    const names = results.map((d) => d.name)
    expect(names).toContain('Unknown Distillery')
    expect(names).toContain('Undisclosed Source')
    expect(names).toContain('Contract Distilled')
  })

  it('respects the limit', () => {
    expect(searchDistilleries('distillery', 3)).toHaveLength(3)
  })

  it('ranks an exact match above a mere substring match', () => {
    const results = searchDistilleries('jura')
    expect(results[0]?.name).toBe('Isle of Jura Distillery')
  })
})

describe('getDistilleryById', () => {
  it('finds a distillery by its stable id', () => {
    expect(getDistilleryById('buffalo-trace-distillery')?.name).toBe('Buffalo Trace Distillery')
  })

  it('returns undefined for an unknown id', () => {
    expect(getDistilleryById('not-a-real-id')).toBeUndefined()
  })
})

describe('resolveDistillery', () => {
  it('resolves a bottle-style free-text distillery string to its canonical record', () => {
    expect(resolveDistillery('buffalo trace')?.name).toBe('Buffalo Trace Distillery')
    expect(resolveDistillery('MGP')?.name).toBe('Ross & Squibb Distillery')
  })

  it('returns undefined for text with no match, rather than guessing', () => {
    expect(resolveDistillery('Some Made Up Distillery Name')).toBeUndefined()
  })

  it('returns undefined for empty/undefined input', () => {
    expect(resolveDistillery(undefined)).toBeUndefined()
    expect(resolveDistillery('   ')).toBeUndefined()
  })
})

describe('distilleryToOption', () => {
  it('builds a label + location sublabel', () => {
    const distillery = getDistilleryById('buffalo-trace-distillery')!
    expect(distilleryToOption(distillery)).toEqual({
      id: 'buffalo-trace-distillery',
      label: 'Buffalo Trace Distillery',
      sublabel: 'Frankfort, Kentucky, United States',
    })
  })

  it('omits the sublabel when no location fields are known', () => {
    const distillery = getDistilleryById('undisclosed-source')!
    expect(distilleryToOption(distillery).sublabel).toBeUndefined()
  })
})

describe('bottleDistilleryMatches', () => {
  it('matches a bottle stored under the canonical name against an alias query', () => {
    expect(bottleDistilleryMatches('Ross & Squibb Distillery', 'MGP')).toBe(true)
  })

  it('matches a bottle stored under an alias against the canonical name query', () => {
    expect(bottleDistilleryMatches('BT', 'Buffalo Trace')).toBe(true)
  })

  it('does not match unrelated distilleries', () => {
    expect(bottleDistilleryMatches('Buffalo Trace Distillery', 'Highland Park')).toBe(false)
  })

  it('returns false when the bottle distillery text has no canonical match at all', () => {
    expect(bottleDistilleryMatches('My Uncle’s Garage Still', 'garage')).toBe(false)
  })
})
