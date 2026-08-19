import { describe, expect, it } from 'vitest'
import { buildDistilleries, normalizeDistilleryName } from './build'

describe('normalizeDistilleryName', () => {
  it('lowercases, collapses punctuation, and strips accents', () => {
    expect(normalizeDistilleryName('Woodford Reserve Distillery')).toBe('woodford reserve distillery')
    expect(normalizeDistilleryName("Nc'nean")).toBe('nc nean')
    expect(normalizeDistilleryName('Café-Brûlé')).toBe('cafe brule')
  })

  it('turns "&" into "and" before collapsing punctuation', () => {
    expect(normalizeDistilleryName('Ross & Squibb Distillery')).toBe('ross and squibb distillery')
  })
})

describe('buildDistilleries', () => {
  it('derives a stable, url-safe id and a normalized name from name alone', () => {
    const [result] = buildDistilleries([{ name: 'Buffalo Trace Distillery', verified: true }])
    expect(result).toMatchObject({ id: 'buffalo-trace-distillery', normalizedName: 'buffalo trace distillery' })
  })

  it('defaults aliases to an empty array when the seed omits it', () => {
    const [result] = buildDistilleries([{ name: 'Some Distillery', verified: true }])
    expect(result?.aliases).toEqual([])
  })

  it('never produces two identical ids, even for two seeds that share a name', () => {
    const results = buildDistilleries([
      { name: 'Highland Park', verified: true },
      { name: 'Highland Park', verified: true },
    ])
    expect(results[0]?.id).toBe('highland-park')
    expect(results[1]?.id).toBe('highland-park-2')
    expect(results[0]?.id).not.toBe(results[1]?.id)
  })

  it('preserves every seed field unchanged', () => {
    const [result] = buildDistilleries([
      {
        name: 'Test Distillery',
        aliases: ['TD'],
        city: 'Somewhere',
        stateProvince: 'Somewhere State',
        country: 'Testland',
        verified: true,
        parentCompany: 'Test Co',
        status: 'active',
      },
    ])
    expect(result).toMatchObject({
      name: 'Test Distillery',
      aliases: ['TD'],
      city: 'Somewhere',
      stateProvince: 'Somewhere State',
      country: 'Testland',
      verified: true,
      parentCompany: 'Test Co',
      status: 'active',
    })
  })
})
