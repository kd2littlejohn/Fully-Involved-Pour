import { describe, expect, it } from 'vitest'
import { pourEducation } from './pourEducation'

describe('pourEducation', () => {
  it('teaches the style from the round name when the bottle is just typed bourbon', () => {
    expect(pourEducation({ name: 'Weller Antique 107', type: 'Bourbon', proof: 107 }, 'Wheated').style).toBe('Wheated bourbon')
  })

  it('prefers the most specific style named anywhere', () => {
    expect(pourEducation({ name: 'Woodford Reserve Double Oaked', type: 'Bourbon' }, 'Double Oaked').style).toBe('Double oaked')
    expect(pourEducation({ name: 'Pikesville', type: 'Rye Whiskey' }, 'Rye').style).toBe('Rye whiskey')
    expect(pourEducation({ name: 'Old Forester 1920', type: 'High Rye Bourbon' }).style).toBe('High-rye bourbon')
    expect(pourEducation({ name: 'Old Grand-Dad Bonded' }).style).toBe('Bottled in Bond')
  })

  it('does not mistake words that merely contain a style keyword', () => {
    expect(pourEducation({ name: 'Spectrum Reserve', type: 'Bourbon' }).style).toBe('Bourbon')
    expect(pourEducation({ name: 'Repeat Offender' }).style).toBe('Whiskey')
  })

  it('falls back to general whiskey education, and adds a water tip only for high proof', () => {
    const general = pourEducation({ name: 'House Pour' })
    expect(general.style).toBe('Whiskey')
    expect(general.tip).toBeUndefined()
    expect(pourEducation({ name: 'Stagg', type: 'Bourbon', proof: 130.4 }).tip).toContain('130.4 proof')
  })

  it('always gives every section and some descriptors', () => {
    const e = pourEducation({ name: 'Castle & Key Wheated' }, 'Wheated')
    for (const key of ['style', 'grain', 'barrel', 'aroma'] as const) expect(e[key].length).toBeGreaterThan(10)
    expect(e.descriptors.length).toBeGreaterThanOrEqual(4)
  })
})
