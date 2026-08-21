import { describe, expect, it } from 'vitest'
import { buildSharedCollectionProjection } from './sharedCollections'
import type { Bottle, PrivacySettings, UserDoc } from '../types'

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'name' | 'status'>): Bottle {
  return overrides
}

function userDoc(bottles: Bottle[]): UserDoc {
  return { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [] }
}

function privacy(overrides: Partial<PrivacySettings> = {}): PrivacySettings {
  return {
    profileVisibility: 'friends',
    collectionVisibility: 'friends',
    pourStoryDefault: 'private',
    wishListVisibility: 'friends',
    ...overrides,
  }
}

describe('buildSharedCollectionProjection', () => {
  it('projects only descriptive, non-personal fields — never price, store, notes, rating, or purchase date', () => {
    const doc = userDoc([
      bottle({
        id: 'b1',
        name: 'Eagle Rare 10 Year',
        status: 'sealed',
        distillery: 'Buffalo Trace',
        imageUrl: 'https://example.com/eagle-rare.jpg',
        type: 'Bourbon',
        region: 'Kentucky',
        proof: 90,
        ageStatement: '10 Year',
        price: 45,
        storeLocation: 'Total Wine',
        purchaseDate: '2026-01-01',
        notes: 'Dad’s favorite',
        rating: 8.6,
        favorite: true,
      }),
    ])

    const projection = buildSharedCollectionProjection('uid-1', doc, privacy())

    expect(projection.bottles).toEqual([
      {
        id: 'b1',
        name: 'Eagle Rare 10 Year',
        distillery: 'Buffalo Trace',
        imageUrl: 'https://example.com/eagle-rare.jpg',
        status: 'sealed',
        type: 'Bourbon',
        region: 'Kentucky',
        proof: 90,
        ageStatement: '10 Year',
      },
    ])
    // The regression guard for this feature's whole privacy premise: none
    // of these personal/financial fields should ever appear on a projected
    // bottle, no matter what's on the source Bottle.
    const projected = projection.bottles[0] as unknown as Record<string, unknown>
    expect(projected.price).toBeUndefined()
    expect(projected.storeLocation).toBeUndefined()
    expect(projected.purchaseDate).toBeUndefined()
    expect(projected.notes).toBeUndefined()
    expect(projected.rating).toBeUndefined()
    expect(projected.favorite).toBeUndefined()
  })

  it('splits bottles into bottles vs. wishlist by status', () => {
    const doc = userDoc([
      bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed' }),
      bottle({ id: 'b2', name: 'Pappy 15', status: 'wishlist' }),
    ])

    const projection = buildSharedCollectionProjection('uid-1', doc, privacy())

    expect(projection.bottles.map((b) => b.id)).toEqual(['b1'])
    expect(projection.wishlist.map((b) => b.id)).toEqual(['b2'])
  })

  it('empties the bottle list entirely when collectionVisibility is private, independent of wishListVisibility', () => {
    const doc = userDoc([
      bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed' }),
      bottle({ id: 'b2', name: 'Pappy 15', status: 'wishlist' }),
    ])

    const projection = buildSharedCollectionProjection('uid-1', doc, privacy({ collectionVisibility: 'private', wishListVisibility: 'friends' }))

    expect(projection.bottles).toEqual([])
    expect(projection.wishlist).toHaveLength(1)
  })

  it('empties the wishlist entirely when wishListVisibility is private, independent of collectionVisibility', () => {
    const doc = userDoc([
      bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed' }),
      bottle({ id: 'b2', name: 'Pappy 15', status: 'wishlist' }),
    ])

    const projection = buildSharedCollectionProjection('uid-1', doc, privacy({ collectionVisibility: 'friends', wishListVisibility: 'private' }))

    expect(projection.bottles).toHaveLength(1)
    expect(projection.wishlist).toEqual([])
  })

  it('projects nothing at all when both visibility settings are private', () => {
    const doc = userDoc([bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed' })])

    const projection = buildSharedCollectionProjection('uid-1', doc, privacy({ collectionVisibility: 'private', wishListVisibility: 'private' }))

    expect(projection.bottles).toEqual([])
    expect(projection.wishlist).toEqual([])
  })
})
