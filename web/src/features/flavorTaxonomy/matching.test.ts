import { describe, expect, it } from 'vitest'
import { matchDescriptorsInText, normalizeToken } from './matching'

describe('normalizeToken', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeToken('  Vanilla   Bean  ')).toBe('vanilla bean')
  })

  it('strips surrounding punctuation', () => {
    expect(normalizeToken('"vanilla,"')).toBe('vanilla')
  })
})

describe('matchDescriptorsInText', () => {
  it('is case-insensitive and matches punctuation-adjacent words', () => {
    expect(matchDescriptorsInText('Hints of VANILLA, oak.')).toEqual(new Set(['Vanilla', 'Oak']))
  })

  it('matches simple plurals', () => {
    expect(matchDescriptorsInText('cherries and grapes')).toEqual(new Set(['Cherry', 'Grape']))
  })

  it('does not false-positive match a tag word inside an unrelated word', () => {
    expect(matchDescriptorsInText('Let it soak in the glass a while.')).toEqual(new Set())
  })

  it('resolves "orange", "orange peel", and "candied orange" all to Fruit-family descriptors', () => {
    expect(matchDescriptorsInText('orange')).toEqual(new Set(['Orange']))
    expect(matchDescriptorsInText('orange peel')).toEqual(new Set(['Orange Peel']))
    expect(matchDescriptorsInText('candied orange')).toEqual(new Set(['Orange Peel']))
  })

  it('resolves "toasted oak" to Toasted Oak only, never also Oak', () => {
    expect(matchDescriptorsInText('toasted oak')).toEqual(new Set(['Toasted Oak']))
  })

  it('resolves "dark chocolate" to Dark Chocolate only, never also Chocolate', () => {
    expect(matchDescriptorsInText('dark chocolate')).toEqual(new Set(['Dark Chocolate']))
  })

  it('resolves "black tea" to Black Tea only, never also Tea', () => {
    expect(matchDescriptorsInText('black tea')).toEqual(new Set(['Black Tea']))
  })

  it('resolves "dark cherry" to Dark Cherry only, never also Cherry', () => {
    expect(matchDescriptorsInText('dark cherry')).toEqual(new Set(['Dark Cherry']))
  })

  it('still matches bare "oak" and "cherry" when the longer phrase is not present', () => {
    expect(matchDescriptorsInText('a little oak and cherry')).toEqual(new Set(['Oak', 'Cherry']))
  })

  it('deduplicates repeated mentions of the same descriptor within one text field', () => {
    expect(matchDescriptorsInText('vanilla, vanilla, vanilla')).toEqual(new Set(['Vanilla']))
  })
})
