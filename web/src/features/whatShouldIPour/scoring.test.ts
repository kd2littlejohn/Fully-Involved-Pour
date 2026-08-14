import { describe, expect, it } from 'vitest'
import type { Bottle, Pour } from '../../data/types'
import { buildCandidates, getRecommendation } from './scoring'
import type { MoodId } from './moods'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)
}

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return {
    occasion: undefined,
    companion: undefined,
    buyAgain: undefined,
    fip: { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

// A deliberately varied 7-bottle collection used for structural checks
// (status filtering, sealed-bottle inclusion, Show Me Another, edge cases,
// explanation text) that don't depend on exactly which mood wins.
const booker: Bottle = { id: 'booker', name: 'Bookers Bourbon', status: 'open', proof: 126.9, type: 'Bourbon', flavors: ['Black Pepper', 'Baking Spice', 'Oak'] }
const weller: Bottle = { id: 'weller', name: 'Weller Special Reserve', status: 'open', proof: 108, type: 'Bourbon', flavors: ['Vanilla', 'Caramel', 'Honey'] }
const michters: Bottle = { id: 'michters', name: "Michter's 10 Rye", status: 'open', proof: 115, type: 'Rye', legacyShelf: true }
const eaglerare: Bottle = { id: 'eaglerare', name: 'Eagle Rare 10', status: 'sealed', proof: 90, type: 'Bourbon' }
const oldforester: Bottle = { id: 'oldforester', name: 'Old Forester 1910', status: 'open', proof: 93, type: 'Bourbon' }
const angelsenvy: Bottle = { id: 'angelsenvy', name: "Angel's Envy Rye", status: 'open', proof: 100, type: 'Rye', flavors: ['Caramel', 'Dark Fruit', 'Oak'] }
const badbottle: Bottle = { id: 'badbottle', name: 'Bottom Shelf Blend', status: 'open', proof: 80, type: 'Bourbon' }

const finished: Bottle = { id: 'finished', name: 'Finished Bottle', status: 'finished', proof: 90 }
const wishlist: Bottle = { id: 'wishlist', name: 'Wishlist Bottle', status: 'wishlist', proof: 90 }
const incoming: Bottle = { id: 'incoming', name: 'Incoming Bottle', status: 'incoming', proof: 90 }

const bottles: Bottle[] = [badbottle, eaglerare, booker, weller, michters, oldforester, angelsenvy, finished, wishlist, incoming]

const pours: Pour[] = [
  pour({ id: 'p1', bottleId: 'booker', date: daysAgo(5), rating: 9.0 }),

  pour({ id: 'p2', bottleId: 'weller', date: daysAgo(3), rating: 8.0 }),
  pour({ id: 'p3', bottleId: 'weller', date: daysAgo(20), rating: 8.0 }),
  pour({ id: 'p4', bottleId: 'weller', date: daysAgo(40), rating: 8.0 }),
  pour({ id: 'p5', bottleId: 'weller', date: daysAgo(60), rating: 8.0 }),
  pour({ id: 'p6', bottleId: 'weller', date: daysAgo(80), rating: 8.0 }),

  pour({ id: 'p7', bottleId: 'michters', date: daysAgo(90), rating: 9.6 }),

  pour({ id: 'p8', bottleId: 'oldforester', date: daysAgo(10), rating: 8.6, companion: 'Mike', buyAgain: 'absolutely' }),
  pour({ id: 'p9', bottleId: 'oldforester', date: daysAgo(30), rating: 8.4, companion: 'Sarah', buyAgain: 'absolutely' }),
  pour({ id: 'p10', bottleId: 'oldforester', date: daysAgo(50), rating: 8.2, companion: 'Dad', buyAgain: 'absolutely' }),
  pour({ id: 'p11', bottleId: 'oldforester', date: daysAgo(70), rating: 8.0 }),

  pour({ id: 'p12', bottleId: 'angelsenvy', date: daysAgo(45), rating: 8.2 }),
  pour({ id: 'p13', bottleId: 'angelsenvy', date: daysAgo(65), rating: 8.0 }),

  pour({ id: 'p14', bottleId: 'badbottle', date: daysAgo(2), rating: 4.0 }),
]

const DETERMINISTIC_MOODS: MoodId[] = ['something-familiar', 'something-special', 'havent-had-lately', 'sweet', 'high-proof']

describe('buildCandidates', () => {
  it('excludes finished, wishlist, and incoming bottles', () => {
    const candidates = buildCandidates(bottles, pours)
    const ids = candidates.map((c) => c.bottle.id)
    expect(ids).not.toContain('finished')
    expect(ids).not.toContain('wishlist')
    expect(ids).not.toContain('incoming')
  })

  it('includes both open and sealed bottles', () => {
    const candidates = buildCandidates(bottles, pours)
    const ids = candidates.map((c) => c.bottle.id)
    expect(ids).toContain('weller') // open
    expect(ids).toContain('eaglerare') // sealed
  })
})

describe('getRecommendation — each mood favors its real signal', () => {
  it('Something Familiar favors frequent revisits over a single high-rated pour', () => {
    const familiar: Bottle = { id: 'familiar', name: 'Familiar Favorite', status: 'open', proof: 90 }
    const rare: Bottle = { id: 'rare', name: 'Rare Treat', status: 'open', proof: 90 }
    const soloPours = [8.0, 8.0, 8.0, 8.0, 8.0].map((rating, i) => pour({ id: `f${i}`, bottleId: 'familiar', date: daysAgo(i * 5 + 1), rating }))
    soloPours.push(pour({ id: 'r1', bottleId: 'rare', date: daysAgo(2), rating: 9.5 }))

    expect(getRecommendation([familiar, rare], soloPours, 'something-familiar')?.bottle.id).toBe('familiar')
  })

  it('Something Special favors Legacy Shelf, high rating, rarely poured', () => {
    expect(getRecommendation(bottles, pours, 'something-special')?.bottle.id).toBe('michters')
  })

  it("Haven't Had Lately favors a never-poured bottle over one poured recently", () => {
    const neglected: Bottle = { id: 'neglected', name: 'Neglected Bottle', status: 'open', proof: 90 }
    const fresh: Bottle = { id: 'fresh', name: 'Fresh Favorite', status: 'open', proof: 90 }
    const twoBottlePours = [
      pour({ id: 'n1', bottleId: 'neglected', date: daysAgo(60), rating: 8.0 }),
      pour({ id: 'fr1', bottleId: 'fresh', date: daysAgo(2), rating: 8.0 }),
    ]

    expect(getRecommendation([neglected, fresh], twoBottlePours, 'havent-had-lately')?.bottle.id).toBe('neglected')
  })

  it('Sweet favors sweet-flavor-tagged bottles over spice-forward ones', () => {
    const sweetBottle: Bottle = { id: 'sweet-b', name: 'Sweet Sipper', status: 'open', proof: 90, flavors: ['Vanilla', 'Caramel', 'Honey'] }
    const spicyBottle: Bottle = { id: 'spicy-b', name: 'Spicy Kick', status: 'open', proof: 90, flavors: ['Black Pepper', 'Cinnamon'] }

    expect(getRecommendation([sweetBottle, spicyBottle], [], 'sweet')?.bottle.id).toBe('sweet-b')
  })

  it('High Proof favors the highest-proof bottle', () => {
    const highProof: Bottle = { id: 'high-proof-b', name: 'Cask Strength', status: 'open', proof: 130 }
    const lowProof: Bottle = { id: 'low-proof-b', name: 'Standard Proof', status: 'open', proof: 80 }

    expect(getRecommendation([highProof, lowProof], [], 'high-proof')?.bottle.id).toBe('high-proof-b')
  })

  it('Surprise Me excludes bottles below the rating floor and respects the injected random source', () => {
    // random() === 0 deterministically selects the first weighted candidate.
    // badbottle (rated 4.0) is listed first in `bottles` but must never win
    // because it's below the poor-rating floor.
    const result = getRecommendation(bottles, pours, 'surprise-me', [], () => 0)
    expect(result?.bottle.id).toBe('eaglerare')
    expect(result?.bottle.id).not.toBe('badbottle')
  })

  it('Surprise Me respects exclude even with a fixed random source', () => {
    const result = getRecommendation(bottles, pours, 'surprise-me', ['eaglerare'], () => 0)
    expect(result?.bottle.id).toBe('booker')
  })
})

describe('getRecommendation — sealed-bottle preference', () => {
  const moodsThatPenalizeSealed: MoodId[] = ['something-familiar', 'sweet', 'high-proof']

  it.each(moodsThatPenalizeSealed)('%s never prefers the only sealed bottle over a comparable open one', (moodId) => {
    // A tiny two-bottle pool: one open, one sealed, otherwise identical.
    const open: Bottle = { id: 'open-1', name: 'Open Twin', status: 'open', proof: 100, rating: 8 }
    const sealed: Bottle = { id: 'sealed-1', name: 'Sealed Twin', status: 'sealed', proof: 100, rating: 8 }
    const result = getRecommendation([open, sealed], [], moodId)
    expect(result?.bottle.id).toBe('open-1')
  })

  it('Something Special, Haven’t Had Lately, and Surprise Me may still recommend a sealed bottle', () => {
    const result = getRecommendation(bottles, pours, 'havent-had-lately')
    expect(result?.bottle.status).toBe('sealed')
  })
})

describe('getRecommendation — edge cases', () => {
  it('returns undefined for an empty collection', () => {
    expect(getRecommendation([], [], 'something-familiar')).toBeUndefined()
  })

  it('handles a collection with only sealed bottles', () => {
    const onlySealed: Bottle[] = [
      { id: 's1', name: 'Sealed One', status: 'sealed', proof: 90 },
      { id: 's2', name: 'Sealed Two', status: 'sealed', proof: 100 },
    ]
    const result = getRecommendation(onlySealed, [], 'something-familiar')
    expect(result).toBeDefined()
    expect(result?.bottle.status).toBe('sealed')
    expect(result?.reasons[0]).toBe("You've never opened this bottle — it's still sealed.")
  })

  it('handles a collection with exactly one eligible bottle', () => {
    const solo: Bottle[] = [{ id: 'solo', name: 'Solo Bottle', status: 'open', proof: 90 }]
    const result = getRecommendation(solo, [], 'high-proof')
    expect(result?.bottle.id).toBe('solo')
  })

  it('excludes finished, wishlist, and incoming bottles from every mood', () => {
    for (const moodId of DETERMINISTIC_MOODS) {
      const result = getRecommendation(bottles, pours, moodId)
      expect(['finished', 'wishlist', 'incoming']).not.toContain(result?.bottle.id)
    }
  })
})

describe('getRecommendation — Show Me Another', () => {
  it('moves to the next eligible recommendation without repeating', () => {
    const solo: Bottle[] = [
      { id: 'w1', name: 'One', status: 'open', proof: 108, flavors: ['Vanilla', 'Caramel', 'Honey'] },
      { id: 'w2', name: 'Two', status: 'open', proof: 93 },
    ]
    const soloPours: Pour[] = [
      pour({ id: 'sp1', bottleId: 'w1', date: daysAgo(3), rating: 8.0 }),
      pour({ id: 'sp2', bottleId: 'w1', date: daysAgo(20), rating: 8.0 }),
      pour({ id: 'sp3', bottleId: 'w1', date: daysAgo(40), rating: 8.0 }),
      pour({ id: 'sp4', bottleId: 'w1', date: daysAgo(60), rating: 8.0 }),
      pour({ id: 'sp5', bottleId: 'w1', date: daysAgo(80), rating: 8.0 }),
      pour({ id: 'sp6', bottleId: 'w2', date: daysAgo(10), rating: 8.6 }),
    ]

    const first = getRecommendation(solo, soloPours, 'something-familiar', [])
    expect(first?.bottle.id).toBe('w1')

    const second = getRecommendation(solo, soloPours, 'something-familiar', [first!.bottle.id])
    expect(second?.bottle.id).toBe('w2')
    expect(second?.bottle.id).not.toBe(first?.bottle.id)
  })

  it('resets rather than dead-ending once every eligible bottle has been shown', () => {
    const solo: Bottle[] = [
      { id: 'w1', name: 'One', status: 'open', proof: 100 },
      { id: 'w2', name: 'Two', status: 'open', proof: 100 },
    ]
    const result = getRecommendation(solo, [], 'something-familiar', ['w1', 'w2'])
    expect(result).toBeDefined()
    // Must not immediately repeat the bottle that was just shown (the last
    // excluded id) even though the exclude list is exhausted.
    expect(result?.bottle.id).not.toBe('w2')
    expect(result?.bottle.id).toBe('w1')
  })

  it('with exactly one eligible bottle, resetting has no choice but to show it again', () => {
    const solo: Bottle[] = [{ id: 'solo', name: 'Solo Bottle', status: 'open', proof: 90 }]
    const result = getRecommendation(solo, [], 'something-familiar', ['solo'])
    expect(result?.bottle.id).toBe('solo')
  })
})

describe('getRecommendation — explanations reference only real signals', () => {
  it('never implies a sealed, never-poured bottle has been poured before', () => {
    const result = getRecommendation(bottles, pours, 'havent-had-lately')
    expect(result?.bottle.id).toBe('eaglerare')
    expect(result?.reasons.join(' ')).not.toMatch(/haven't poured this in|poured this once/)
    expect(result?.reasons).toContain("You've never opened this bottle — it's still sealed.")
  })

  it('cites real pour-count and Legacy Shelf signals for Something Special', () => {
    const result = getRecommendation(bottles, pours, 'something-special')
    expect(result?.bottle.id).toBe('michters')
    expect(result?.reasons).toEqual(["You've only poured this once.", 'This is a Legacy Shelf bottle.'])
  })

  it('falls back to an honest, non-fabricated mood statement when no specific signal applies', () => {
    // Force oldforester to be the sole candidate for a mood — it has no
    // Legacy Shelf flag, isn't the pool's top-rated or Core Bar bottle, and
    // isn't recently neglected, so no specific signal should fire.
    const exclude = bottles.map((b) => b.id).filter((id) => id !== 'oldforester')
    const result = getRecommendation(bottles, pours, 'sweet', exclude)
    expect(result?.bottle.id).toBe('oldforester')
    expect(result?.reasons).toEqual(['A strong fit for a Sweet pour right now.'])
  })
})
