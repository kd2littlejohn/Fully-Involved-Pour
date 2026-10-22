import { describe, expect, it } from 'vitest'
import { createReadConfirmer } from './decoder'

describe('createReadConfirmer', () => {
  it('accepts a code only after the same valid read repeats', () => {
    const confirmer = createReadConfirmer(2)
    expect(confirmer.offer('036000291452')).toBeNull()
    expect(confirmer.offer('036000291452')).toMatchObject({ gtin13: '0036000291452' })
  })

  it('treats UPC-A and its EAN-13 form as the same read', () => {
    const confirmer = createReadConfirmer(2)
    expect(confirmer.offer('036000291452')).toBeNull()
    expect(confirmer.offer('0036000291452')).toMatchObject({ gtin13: '0036000291452' })
  })

  it('restarts the streak when a different code is read', () => {
    const confirmer = createReadConfirmer(2)
    confirmer.offer('036000291452')
    expect(confirmer.offer('4006381333931')).toBeNull()
    expect(confirmer.offer('4006381333931')).toMatchObject({ gtin13: '4006381333931' })
  })

  it('counts and drops misreads that fail the check digit', () => {
    const confirmer = createReadConfirmer(2)
    confirmer.offer('036000291452')
    expect(confirmer.offer('036000291453')).toBeNull()
    expect(confirmer.offer('036000291452')).toBeNull()
    expect(confirmer.rejected).toBe(1)
  })

  it('needs one extra matching read for UPC-E, which glare can fake from half an EAN-13', () => {
    const confirmer = createReadConfirmer(2)
    expect(confirmer.offer('01234565')).toBeNull()
    expect(confirmer.offer('01234565')).toBeNull()
    expect(confirmer.offer('01234565')).toMatchObject({ symbology: 'UPC_E' })
  })

  it('accepts the first valid read when one confirmation is enough', () => {
    expect(createReadConfirmer(1).offer('036000291452')).toMatchObject({ symbology: 'UPC_A' })
  })
})
