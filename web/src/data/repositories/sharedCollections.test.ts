import { describe, expect, it } from 'vitest'
import { buildSharedCollectionProjection } from './sharedCollections'
import type { Bottle, Pour, PrivacySettings, UserDoc } from '../types'

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'name' | 'status'>): Bottle {
  return overrides
}

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return { fip: { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: overrides.rating, noseAromas: [], palateFlavors: [] }, ...overrides }
}

function userDoc(bottles: Bottle[], pours: Pour[] = []): UserDoc {
  return { bottles, pours, memories: [], infinityBottles: [], customLibrary: [] }
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

  describe('friend bottle take (Friend Bottle Quick View)', () => {
    it('omits take entirely when pourStoryDefault is not "friends", even though the bottle itself is shared', () => {
      const doc = userDoc(
        [bottle({ id: 'b1', name: 'Eagle Rare', status: 'open', buyAgain: 'absolutely', flavors: ['Caramel'] })],
        [pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 9.3 })],
      )

      const projection = buildSharedCollectionProjection('uid-1', doc, privacy({ pourStoryDefault: 'private' }))
      expect(projection.bottles[0]?.take).toBeUndefined()

      const selectedFriendsProjection = buildSharedCollectionProjection('uid-1', doc, privacy({ pourStoryDefault: 'selected-friends' }))
      expect(selectedFriendsProjection.bottles[0]?.take).toBeUndefined()
    })

    it('computes score, latest take, buy-again/replace, top flavors, pour count, and last pour date from real pours when pourStoryDefault is "friends"', () => {
      const doc = userDoc(
        [
          bottle({
            id: 'b1',
            name: 'Eagle Rare',
            status: 'open',
            buyAgain: 'absolutely',
            wouldReplace: 'yes',
            flavors: ['Caramel', 'Cherry', 'Oak', 'Vanilla', 'Leather'],
            price: 45,
            notes: 'Private bottle note — never shared',
          }),
        ],
        [
          pour({ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.9, memory: 'First pour, pretty good.' }),
          pour({ id: 'p2', bottleId: 'b1', date: '2026-03-15', rating: 9.3, memory: 'Rich caramel, cherry and oak. Hot at first but opens up beautifully.' }),
        ],
      )

      const projection = buildSharedCollectionProjection('uid-1', doc, privacy({ pourStoryDefault: 'friends' }))
      const take = projection.bottles[0]?.take

      expect(take?.score).toBe(9.3)
      expect(take?.latestTake).toBe('Rich caramel, cherry and oak. Hot at first but opens up beautifully.')
      expect(take?.buyAgain).toBe('absolutely')
      expect(take?.wouldReplace).toBe('yes')
      expect(take?.topFlavors).toEqual(['Caramel', 'Cherry', 'Oak', 'Vanilla'])
      expect(take?.pourCount).toBe(2)
      expect(take?.lastPourDate).toBe('2026-03-15')
    })

    it('falls back to the bottle’s own settled rating when no pour has been logged yet', () => {
      const doc = userDoc([bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed', rating: 8.0 })])

      const projection = buildSharedCollectionProjection('uid-1', doc, privacy({ pourStoryDefault: 'friends' }))
      const take = projection.bottles[0]?.take

      expect(take?.score).toBe(8.0)
      expect(take?.pourCount).toBe(0)
      expect(take?.latestTake).toBeUndefined()
    })

    it('leaves take undefined for a bottle with no rating, take fields, or pours at all — never a hollow object', () => {
      const doc = userDoc([bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed' })])

      const projection = buildSharedCollectionProjection('uid-1', doc, privacy({ pourStoryDefault: 'friends' }))
      expect(projection.bottles[0]?.take).toBeUndefined()
    })

    it('never leaks price or private notes through the take object', () => {
      const doc = userDoc([bottle({ id: 'b1', name: 'Eagle Rare', status: 'sealed', rating: 8.0, price: 45, notes: 'Private note' })])

      const projection = buildSharedCollectionProjection('uid-1', doc, privacy({ pourStoryDefault: 'friends' }))
      const take = projection.bottles[0]?.take as unknown as Record<string, unknown>

      expect(take.price).toBeUndefined()
      expect(take.notes).toBeUndefined()
    })
  })
})
