import { describe, expect, it, vi } from 'vitest'

vi.mock('../devMode', () => ({ isMockAuthEnabled: () => true }))

import { findBottleByUpc, lookupBottleByBarcode, saveBottleToCatalog, BarcodeLookupTimeoutError } from './barcode'

describe('barcode repository (mock mode)', () => {
  it('findBottleByUpc resolves the canned fixture UPC and misses everything else', async () => {
    const hit = await findBottleByUpc('000000000000')
    expect(hit?.found).toBe(true)
    expect(hit?.name).toBeTruthy()

    const miss = await findBottleByUpc('999999999999')
    expect(miss).toBeUndefined()
  })

  it('lookupBottleByBarcode resolves the canned fixture UPC and reports not-found for everything else', async () => {
    const hit = await lookupBottleByBarcode('111111111111')
    expect(hit.found).toBe(true)
    expect(hit.name).toBeTruthy()

    const miss = await lookupBottleByBarcode('999999999999')
    expect(miss.found).toBe(false)
  })

  it('saveBottleToCatalog resolves without error (no Cloud Function call) in mock mode', async () => {
    await expect(saveBottleToCatalog('012345678905', { name: 'Test Bottle' })).resolves.toBeUndefined()
  })

  it('BarcodeLookupTimeoutError is a real, catchable Error subclass', () => {
    const err = new BarcodeLookupTimeoutError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('BarcodeLookupTimeoutError')
  })
})
