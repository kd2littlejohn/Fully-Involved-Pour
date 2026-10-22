// Same vectors as functions/barcode/gtin.test.js — the two copies
// must agree on every key.
import { describe, expect, it } from 'vitest'
import { expandUpcE, normalizeBarcode } from './gtin'

function valid(code: string) {
  const result = normalizeBarcode(code)
  if (result.error !== undefined) throw new Error(result.error)
  return result
}

describe('normalizeBarcode', () => {
  it('keys UPC-A as GTIN-13 with a leading zero', () => {
    expect(normalizeBarcode('036000291452')).toEqual({
      gtin13: '0036000291452',
      upcA: '036000291452',
      symbology: 'UPC_A',
      restricted: false,
    })
  })

  it('gives the same key for the EAN-13 form of a UPC-A code', () => {
    expect(valid('0036000291452').gtin13).toBe(valid('036000291452').gtin13)
  })

  it('accepts a non-US EAN-13', () => {
    expect(normalizeBarcode('4006381333931')).toEqual({
      gtin13: '4006381333931',
      upcA: undefined,
      symbology: 'EAN_13',
      restricted: false,
    })
  })

  it('expands UPC-E to UPC-A for every last-digit rule', () => {
    expect(expandUpcE('01234565')).toBe('012345000065')
    expect(expandUpcE('01234505')).toBe('012000003455')
    expect(expandUpcE('01234531')).toBe('012300000451')
    expect(expandUpcE('01234543')).toBe('012340000053')
    expect(normalizeBarcode('01234565')).toMatchObject({ gtin13: '0012345000065', symbology: 'UPC_E' })
  })

  it('rejects a bad check digit instead of guessing', () => {
    expect(normalizeBarcode('036000291453')).toEqual({ error: 'bad-check-digit' })
    expect(normalizeBarcode('4006381333932')).toEqual({ error: 'bad-check-digit' })
  })

  it('rejects unsupported lengths and non-numeric input', () => {
    expect(normalizeBarcode('12345')).toEqual({ error: 'unsupported-length' })
    expect(normalizeBarcode('ABC123456789')).toEqual({ error: 'not-numeric' })
    expect(normalizeBarcode(undefined)).toEqual({ error: 'not-numeric' })
  })

  it('flags store-applied and variable-weight labels as restricted', () => {
    // UPC number system 2 (random weight) and 4 (in-store).
    expect(valid('212345678909').restricted).toBe(true)
    expect(valid('412345678903').restricted).toBe(true)
    // EAN restricted-circulation prefix 2x.
    expect(valid('2001234567893').restricted).toBe(true)
  })
})
