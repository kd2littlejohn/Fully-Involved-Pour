import { describe, expect, it } from 'vitest'
import type { BarcodeBottle } from '../../data/repositories/barcode'
import type { Bottle } from '../../data/types'
import { buildNewBottleInput, composeBarName, findInBar, planIncreaseQuantity } from './inventory'

const GTIN = '0036000291452'
const scanned = (overrides: Partial<BarcodeBottle> = {}): BarcodeBottle => ({
  name: 'Example Barrel Proof',
  distillery: 'Example Distillery',
  brand: null,
  expression: null,
  category: 'Bourbon',
  sizeMl: 750,
  proof: null,
  proofVaries: true,
  ageStatement: '12 Year',
  releaseKind: 'barrel-proof-batch',
  batch: null,
  barrel: null,
  storePick: null,
  releaseYear: null,
  ...overrides,
})
const barBottle = (overrides: Partial<Bottle> = {}): Bottle => ({ id: 'b1', name: 'Example Barrel Proof', distillery: 'Example Distillery', status: 'sealed', ...overrides })

describe('composeBarName', () => {
  it('adds batch, barrel and store pick to the name so releases stay distinct', () => {
    expect(composeBarName(scanned({ batch: 'C924' }))).toBe('Example Barrel Proof — Batch C924')
    expect(composeBarName(scanned({ barrel: '77', storePick: 'Store A' }))).toBe('Example Barrel Proof — Barrel 77 — Store A Pick')
  })

  it('does not repeat a detail already in the name', () => {
    expect(composeBarName(scanned({ name: 'Example Barrel Proof Batch C924', batch: 'C924' }))).toBe('Example Barrel Proof Batch C924')
  })
})

describe('findInBar', () => {
  it('finds the same release by name, even when it was added without a barcode', () => {
    expect(findInBar([barBottle()], GTIN, scanned()).sameRelease.map((b) => b.id)).toEqual(['b1'])
  })

  it('finds the bottle this barcode was saved as last time', () => {
    expect(findInBar([barBottle({ id: 'b9', name: 'Renamed' })], GTIN, scanned(), 'b9').sameRelease.map((b) => b.id)).toEqual(['b9'])
  })

  it('lists a different release with the same barcode separately, not as a duplicate', () => {
    const bar = [barBottle({ id: 'b2', name: 'Example Barrel Proof — Batch B524', upc: '036000291452' })]
    expect(findInBar(bar, GTIN, scanned({ batch: 'C924' }))).toEqual({ sameRelease: [], sameBarcode: [bar[0]] })
  })

  it('matches stored barcodes in any printed form', () => {
    const bar = [barBottle({ id: 'b3', name: 'Something Else', upc: '0036000291452' })]
    expect(findInBar(bar, GTIN, scanned()).sameBarcode).toHaveLength(1)
  })
})

describe('buildNewBottleInput', () => {
  it('maps onto the existing Bottle fields, keeping the barcode in upc', () => {
    expect(buildNewBottleInput(scanned({ batch: 'C924', proof: 124.6 }), 'wishlist', '036000291452')).toEqual({
      name: 'Example Barrel Proof — Batch C924',
      distillery: 'Example Distillery',
      type: 'Bourbon',
      proof: 124.6,
      bottleSize: 750,
      ageStatement: '12 Year',
      status: 'wishlist',
      upc: '036000291452',
    })
  })

  it('leaves proof empty when it is unknown for this bottle', () => {
    expect(buildNewBottleInput(scanned(), 'sealed', '036000291452').proof).toBeUndefined()
  })
})

describe('planIncreaseQuantity', () => {
  let n = 0
  const id = () => `i${(n += 1)}`

  it('adds one sealed instance to a bottle that already tracks instances', () => {
    const bottle = barBottle({ instances: [{ id: 'x', createdAt: 1, status: 'open' }, { id: 'y', createdAt: 2, status: 'sealed' }] })
    expect(planIncreaseQuantity(bottle, id)).toEqual({ kind: 'add-instance' })
  })

  it('turns a plain bottle into Bottle 1 plus a new sealed bottle, keeping its own details', () => {
    const plan = planIncreaseQuantity(barBottle({ status: 'open', openedDate: '2026-01-02', price: 60, fillLevel: 'half' }), id, 100)
    if (plan.kind !== 'update') throw new Error(plan.kind)
    expect(plan.quantity).toBe(2)
    expect(plan.patch.instances).toEqual([
      expect.objectContaining({ status: 'open', openedDate: '2026-01-02', price: 60, fillLevel: 'half' }),
      expect.objectContaining({ status: 'sealed' }),
    ])
    expect(plan.patch).toMatchObject({ status: 'open', quantity: 2 })
    expect(plan.patch.activeInstanceId).toBe(plan.patch.instances?.[0]?.id)
  })

  it('keeps an existing plain quantity when converting', () => {
    const plan = planIncreaseQuantity(barBottle({ quantity: 3 }), id)
    expect(plan.kind === 'update' && plan.patch.instances?.length).toBe(4)
  })

  it('moves a wishlist bottle into My Bar instead', () => {
    expect(planIncreaseQuantity(barBottle({ status: 'wishlist' }), id)).toEqual({ kind: 'move-to-bar', patch: { status: 'sealed' } })
  })
})
