// Scan Barcode ↔ My Bar. Uses the existing Bottle model unchanged: the
// scanned barcode goes in the existing `upc` field, and batch / barrel /
// store pick (which have no field of their own) become part of the bottle
// name, the way collectors already name these bottles — which is also what
// keeps two picks with the same UPC from looking like duplicates.

import type { Bottle, BottleStatus } from '../../data/types'
import type { BarcodeBottle } from '../../data/repositories/barcode'
import type { BottlePatch, NewBottleInput } from '../../hooks/useUserData'
import { blankInstance, instanceFromLegacyFields, resolveActiveInstanceId, rollupFromInstances } from '../bottleInstances/selectors'
import { normalizeBarcode } from './gtin'

function key(text: string | null | undefined): string {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function composeBarName(bottle: BarcodeBottle): string {
  const parts = [bottle.name.trim()]
  const has = (part: string) => key(parts.join(' ')).includes(key(part))
  if (bottle.batch && !has(bottle.batch)) parts.push(`Batch ${bottle.batch}`)
  if (bottle.barrel && !has(bottle.barrel)) parts.push(`Barrel ${bottle.barrel}`)
  if (bottle.storePick && !has(bottle.storePick)) parts.push(`${bottle.storePick} Pick`)
  return parts.join(' — ')
}

function barcodeKey(upc: string | undefined): string | null {
  if (!upc) return null
  const n = normalizeBarcode(upc)
  return n.error === undefined ? n.gtin13 : null
}

export interface BarMatches {
  /** The same release is already in this user's bar or wishlist. */
  sameRelease: Bottle[]
  /** Other releases with the same barcode (e.g. a different store pick). */
  sameBarcode: Bottle[]
}

export function findInBar(bottles: Bottle[], gtin13: string, bottle: BarcodeBottle, savedBottleId?: string | null): BarMatches {
  const name = key(composeBarName(bottle))
  const distillery = key(bottle.distillery)
  const sameRelease: Bottle[] = []
  const sameBarcode: Bottle[] = []
  for (const b of bottles) {
    const sameName = key(b.name) === name && (!distillery || !b.distillery || key(b.distillery) === distillery)
    if (b.id === savedBottleId || sameName) sameRelease.push(b)
    else if (barcodeKey(b.upc) === gtin13) sameBarcode.push(b)
  }
  return { sameRelease, sameBarcode }
}

export function buildNewBottleInput(bottle: BarcodeBottle, status: BottleStatus, printedBarcode: string): NewBottleInput {
  return {
    name: composeBarName(bottle),
    distillery: bottle.distillery ?? undefined,
    type: bottle.category ?? undefined,
    // Only a proof the user has (verified for this release, read from their
    // label, or typed) — never a placeholder for a variable-proof release.
    proof: bottle.proof ?? undefined,
    bottleSize: bottle.sizeMl ?? undefined,
    ageStatement: bottle.ageStatement ?? undefined,
    status,
    upc: printedBarcode,
  }
}

export type QuantityPlan =
  | { kind: 'add-instance' }
  | { kind: 'update'; patch: BottlePatch; quantity: number }
  | { kind: 'move-to-bar'; patch: BottlePatch }

// "Increase quantity" on a bottle already in My Bar, through the same
// instance model Add Bottle and Bottle Details use: a bottle that already
// has instances gets one more sealed instance (addBottleInstance); a plain
// bottle is converted the way Add Bottle does when quantity is raised —
// its own fields become Bottle 1, any existing plain quantity is kept, and
// one new sealed bottle is added. A wishlist bottle moves to My Bar instead.
export function planIncreaseQuantity(bottle: Bottle, generateId: () => string, now = Date.now()): QuantityPlan {
  if (bottle.status === 'wishlist') return { kind: 'move-to-bar', patch: { status: 'sealed' } }
  if (bottle.instances && bottle.instances.length > 0) return { kind: 'add-instance' }
  const existing = Math.max(1, bottle.quantity ?? 1)
  const instances = [
    instanceFromLegacyFields(bottle, generateId(), now),
    ...Array.from({ length: existing }, (_, i) => blankInstance(generateId(), now + i + 1)),
  ]
  const activeInstanceId = resolveActiveInstanceId(instances, undefined)
  return {
    kind: 'update',
    quantity: instances.length,
    patch: { instances, activeInstanceId, ...rollupFromInstances(instances, activeInstanceId) },
  }
}
