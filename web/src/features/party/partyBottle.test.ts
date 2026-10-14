import { describe, expect, it } from 'vitest'
import { bottleSummary, partyBottleFromMyBar } from './partyBottle'
import type { Bottle } from '../../data/types'

describe('partyBottleFromMyBar', () => {
  const bottle: Bottle = {
    id: 'b-1',
    name: 'Weller 12',
    distillery: 'Buffalo Trace',
    type: 'Bourbon',
    ageStatement: '12 years',
    proof: 90,
    msrp: 40,
    status: 'open',
    quantity: 2,
    fillLevel: 'half',
    imageUrl: 'https://firebasestorage.googleapis.com/x.png',
  }

  it('snapshots display details and never mutates the My Bar bottle', () => {
    const before = JSON.stringify(bottle)
    const snapshot = partyBottleFromMyBar(bottle)
    expect(snapshot).toEqual({
      name: 'Weller 12',
      distillery: 'Buffalo Trace',
      type: 'Bourbon',
      age: '12 years',
      proof: 90,
      price: 40,
      imageUrl: 'https://firebasestorage.googleapis.com/x.png',
      bottleId: 'b-1',
      source: 'my-bar',
    })
    expect(JSON.stringify(bottle)).toBe(before)
    // Inventory fields never travel into the party.
    expect(snapshot).not.toHaveProperty('quantity')
    expect(snapshot).not.toHaveProperty('fillLevel')
    expect(snapshot).not.toHaveProperty('status')
  })

  it('drops non-https images and ids the server would reject', () => {
    const snapshot = partyBottleFromMyBar({ ...bottle, id: 'weird id/with slash', imageUrl: 'blob:local' })
    expect(snapshot.imageUrl).toBeUndefined()
    expect(snapshot.bottleId).toBeUndefined()
  })

  it('summarizes the private details for the host', () => {
    expect(bottleSummary(partyBottleFromMyBar(bottle))).toBe('Buffalo Trace · Bourbon · 12 years · 90 proof · $40')
  })
})
