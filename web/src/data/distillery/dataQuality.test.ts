import { describe, expect, it } from 'vitest'
import { DISTILLERIES } from './index'

describe('DISTILLERIES data quality', () => {
  it('has a substantial, multi-country dataset', () => {
    expect(DISTILLERIES.length).toBeGreaterThan(250)
  })

  it('never produces two records with the same id', () => {
    const ids = DISTILLERIES.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every record a non-empty name and a boolean verified flag', () => {
    for (const d of DISTILLERIES) {
      expect(d.name.trim().length).toBeGreaterThan(0)
      expect(typeof d.verified).toBe('boolean')
    }
  })

  it('never duplicates the exact same name twice', () => {
    const names = DISTILLERIES.map((d) => d.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('covers every country the feature was asked to support', () => {
    const countries = new Set(DISTILLERIES.map((d) => d.country).filter(Boolean))
    for (const expected of [
      'United States',
      'Scotland',
      'Ireland',
      'Canada',
      'Japan',
      'India',
      'Australia',
      'Taiwan',
      'England',
      'Wales',
      'France',
    ]) {
      expect(countries.has(expected)).toBe(true)
    }
  })

  it('keeps the three non-geographic sourcing placeholders distinct from real distilleries', () => {
    const placeholders = ['Unknown Distillery', 'Undisclosed Source', 'Contract Distilled']
    for (const name of placeholders) {
      const record = DISTILLERIES.find((d) => d.name === name)
      expect(record?.country).toBeUndefined()
      expect(record?.verified).toBe(false)
    }
  })

  it('never lists a known brand name as a distillery record of its own', () => {
    const brandNames = ['Weller', 'Eagle Rare', 'E.H. Taylor', 'Elijah Craig', "Russell's Reserve", "Maker's 46"]
    const names = new Set(DISTILLERIES.map((d) => d.name))
    for (const brand of brandNames) {
      expect(names.has(brand)).toBe(false)
    }
  })
})
