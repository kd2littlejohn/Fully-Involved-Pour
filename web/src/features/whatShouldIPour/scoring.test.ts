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

// A deliberately varied 7-bottle collection: each bottle is constructed to
// be the clear, unambiguous winner for exactly one mood, so ranking
// assertions aren't sensitive to small weight tweaks.
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

function idsExcept(...keep: string[]): string[] {
  return bottles.map((b) => b.id).filter((id) => !keep.includes(id))
}

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

describe('getRecommendation — all seven moods', () => {
  it('Big & Bold favors high proof, high rating, bold flavor tags', () => {
    expect(getRecommendation(bottles, pours, 'big-bold')?.bottle.id).toBe('booker')
  })

  it('Easy Night favors moderate proof, frequent revisits, approachable flavor', () => {
    expect(getRecommendation(bottles, pours, 'easy-night')?.bottle.id).toBe('weller')
  })

  it('Something Special favors Legacy Shelf, high rating, rarely poured', () => {
    expect(getRecommendation(bottles, pours, 'something-special')?.bottle.id).toBe('michters')
  })

  it('Explore My Bar favors a never-poured, sealed bottle', () => {
    expect(getRecommendation(bottles, pours, 'explore-bar')?.bottle.id).toBe('eaglerare')
  })

  it('Sharing With Friends favors companion history and buy-again score', () => {
    expect(getRecommendation(bottles, pours, 'sharing-friends')?.bottle.id).toBe('oldforester')
  })

  it('Nightcap favors dessert/oak/dark-fruit flavor axes', () => {
    expect(getRecommendation(bottles, pours, 'nightcap')?.bottle.id).toBe('angelsenvy')
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
  const moodsThatPenalizeSealed: MoodId[] = ['big-bold', 'easy-night', 'sharing-friends', 'nightcap']

  it.each(moodsThatPenalizeSealed)('%s never prefers the only sealed bottle over a comparable open one', (moodId) => {
    // A tiny two-bottle pool: one open, one sealed, otherwise identical.
    const open: Bottle = { id: 'open-1', name: 'Open Twin', status: 'open', proof: 100, rating: 8 }
    const sealed: Bottle = { id: 'sealed-1', name: 'Sealed Twin', status: 'sealed', proof: 100, rating: 8 }
    const result = getRecommendation([open, sealed], [], moodId)
    expect(result?.bottle.id).toBe('open-1')
  })

  it('Something Special, Explore My Bar, and Surprise Me may still recommend a sealed bottle', () => {
    const result = getRecommendation(bottles, pours, 'explore-bar')
    expect(result?.bottle.status).toBe('sealed')
  })
})

describe('getRecommendation — edge cases', () => {
  it('returns undefined for an empty collection', () => {
    expect(getRecommendation([], [], 'easy-night')).toBeUndefined()
  })

  it('handles a collection with only sealed bottles', () => {
    const onlySealed: Bottle[] = [
      { id: 's1', name: 'Sealed One', status: 'sealed', proof: 90 },
      { id: 's2', name: 'Sealed Two', status: 'sealed', proof: 100 },
    ]
    const result = getRecommendation(onlySealed, [], 'easy-night')
    expect(result).toBeDefined()
    expect(result?.bottle.status).toBe('sealed')
    expect(result?.reasons[0]).toBe("You've never opened this bottle — it's still sealed.")
  })

  it('handles a collection with exactly one eligible bottle', () => {
    const solo: Bottle[] = [{ id: 'solo', name: 'Solo Bottle', status: 'open', proof: 90 }]
    const result = getRecommendation(solo, [], 'big-bold')
    expect(result?.bottle.id).toBe('solo')
  })

  it('excludes finished, wishlist, and incoming bottles from every mood', () => {
    for (const moodId of ['big-bold', 'easy-night', 'something-special', 'explore-bar', 'sharing-friends', 'nightcap'] as MoodId[]) {
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

    const first = getRecommendation(solo, soloPours, 'easy-night', [])
    expect(first?.bottle.id).toBe('w1')

    const second = getRecommendation(solo, soloPours, 'easy-night', [first!.bottle.id])
    expect(second?.bottle.id).toBe('w2')
    expect(second?.bottle.id).not.toBe(first?.bottle.id)
  })

  it('resets rather than dead-ending once every eligible bottle has been shown', () => {
    const solo: Bottle[] = [
      { id: 'w1', name: 'One', status: 'open', proof: 100 },
      { id: 'w2', name: 'Two', status: 'open', proof: 100 },
    ]
    const result = getRecommendation(solo, [], 'easy-night', ['w1', 'w2'])
    expect(result).toBeDefined()
    // Must not immediately repeat the bottle that was just shown (the last
    // excluded id) even though the exclude list is exhausted.
    expect(result?.bottle.id).not.toBe('w2')
    expect(result?.bottle.id).toBe('w1')
  })

  it('with exactly one eligible bottle, resetting has no choice but to show it again', () => {
    const solo: Bottle[] = [{ id: 'solo', name: 'Solo Bottle', status: 'open', proof: 90 }]
    const result = getRecommendation(solo, [], 'easy-night', ['solo'])
    expect(result?.bottle.id).toBe('solo')
  })
})

describe('getRecommendation — explanations reference only real signals', () => {
  it('never implies a sealed, never-poured bottle has been poured before', () => {
    const result = getRecommendation(bottles, pours, 'explore-bar')
    expect(result?.bottle.id).toBe('eaglerare')
    expect(result?.reasons.join(' ')).not.toMatch(/haven't poured this in|poured this once/)
    expect(result?.reasons).toContain("You've never opened this bottle — it's still sealed.")
  })

  it('cites real pour-count and Legacy Shelf signals for Something Special', () => {
    const result = getRecommendation(bottles, pours, 'something-special')
    expect(result?.bottle.id).toBe('michters')
    expect(result?.reasons).toEqual(["You've only poured this once.", 'This is a Legacy Shelf bottle.'])
  })

  it('cites real companion history for Sharing With Friends', () => {
    const result = getRecommendation(bottles, pours, 'sharing-friends')
    expect(result?.bottle.id).toBe('oldforester')
    expect(result?.reasons).toContain("You've shared this bottle with company before.")
  })

  it('falls back to an honest, non-fabricated mood statement when no specific signal applies', () => {
    // Force oldforester to be the sole nightcap candidate — it has no
    // Legacy Shelf flag, isn't the pool's top-rated or Core Bar bottle, and
    // isn't recently neglected, so no specific signal should fire.
    const result = getRecommendation(bottles, pours, 'nightcap', idsExcept('oldforester'))
    expect(result?.bottle.id).toBe('oldforester')
    expect(result?.reasons).toEqual(['A strong fit for a Nightcap pour right now.'])
  })
})
