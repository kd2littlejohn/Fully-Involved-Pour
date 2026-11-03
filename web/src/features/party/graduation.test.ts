import { describe, expect, it } from 'vitest'
import { buildGraduation } from './graduation'
import { makeCategory, makeParty } from './__fixtures__/party'
import type { PartyBallot, PartyCategoryResults } from './types'

function results(categoryId: string, name: string, bottles: [string, string, number?][], averages: number[]): PartyCategoryResults {
  return {
    partyId: 'p1', categoryId, name, description: '', champions: [], peoplesChoice: [], awards: [], ballotsCounted: 10, ratingsCounted: 30,
    guestScores: [], revealedAt: 5,
    samples: bottles.map(([label, bottle, proof], i) => ({
      label, bottle: { name: bottle, ...(proof ? { proof } : {}) }, average: averages[i] ?? null, count: 10, rank: null, favoriteVotes: 0, isChampion: false, isPeoplesChoice: false,
    })),
  }
}

function ballot(categoryId: string, scores: Record<string, [number, string[]]>): PartyBallot {
  return {
    id: `${categoryId}__g1`, partyId: 'p1', categoryId, participantKey: 'g1', source: 'digital', ownerUid: 'u1', mode: 'detailed',
    scores: Object.fromEntries(Object.entries(scores).map(([l, [overall, descriptors]]) => [l, { overall, descriptors }])),
    favoriteLabel: null, predictionLabel: null, excluded: false, createdAt: 1, updatedAt: 1, revision: 1, finalizedAt: 2,
  }
}

describe('buildGraduation', () => {
  const party = makeParty({
    name: 'Proof of Graduation', status: 'completed',
    categories: [makeCategory({ id: 'f1', name: 'Flight 1 — Wheated Bourbon', state: 'revealed' }), makeCategory({ id: 'f2', name: 'Flight 2 — Rye Whiskey', state: 'revealed' }), makeCategory({ id: 'f3', name: 'Flight 3 — Double Oaked', state: 'voting_closed' })],
  })
  const res = {
    f1: results('f1', 'Flight 1 — Wheated Bourbon', [['A', 'Castle & Key Wheated'], ['B', 'Weller Antique 107', 107], ['C', 'Redwood Empire']], [7, 8.5, 6]),
    f2: results('f2', 'Flight 2 — Rye Whiskey', [['A', 'E.H. Taylor Rye', 100], ['B', '1792 Rye'], ['C', 'Elijah Craig BP Rye']], [7.5, 6.5, 8]),
  }
  const ballots = [
    ballot('f1', { A: [7, ['Caramel', 'Vanilla']], B: [9, ['Caramel', 'Honey']], C: [6, ['Bread']] }),
    ballot('f2', { A: [9, ['Cinnamon', 'Black Pepper']], B: [5, ['Black Pepper']], C: [8, ['Clove']] }),
    ballot('f3', { A: [10, ['Oak']] }),
  ]

  it('uses only revealed rounds and the taster’s own scores', () => {
    const g = buildGraduation({ party, ballots, results: res, group: 'blind', now: 99 })!
    expect(g.poursRated).toBe(6) // flight 3 isn't revealed, so its 10 doesn't count
    expect(g.totalPours).toBe(9)
    expect(g.completed).toBe(true)
    expect(g.experience).toBe('blind')
    expect(g.id).toBe('party:p1')
  })

  it('ties for favorite bottle are all shown; favorite flight breaks ties by order', () => {
    const g = buildGraduation({ party, ballots, results: res, group: null })!
    expect(g.favoriteBottles.map((b) => b.name)).toEqual(['Weller Antique 107', 'E.H. Taylor Rye'])
    // Both flights average 7.3; the earlier one wins the tie.
    expect(g.favoriteFlight).toEqual({ name: 'Flight 1 — Wheated Bourbon', average: 7.3 })
  })

  it('lists the most-noticed flavors and compares with the room', () => {
    const g = buildGraduation({ party, ballots, results: res, group: null })!
    expect(g.topFlavors.slice(0, 2)).toEqual(['Black Pepper', 'Caramel'])
    expect(g.versusRoom).toBe(0.1) // (44 - 43.5) / 6 pours
    expect(g.profile.title).toBeTruthy()
    expect(g.profile.summary).toMatch(/rated Wheated Bourbon highest/)
  })

  it('returns nothing until a round the taster scored is revealed', () => {
    expect(buildGraduation({ party: makeParty(), ballots, results: {}, group: null })).toBeNull()
  })
})
