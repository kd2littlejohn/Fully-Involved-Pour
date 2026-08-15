import { describe, expect, it } from 'vitest'
import { computeRevealHighlights } from './highlights'
import type { BlindFinalRanking, BlindSecretPour, BlindTastingResponse } from '../../data/types'

const pours: BlindSecretPour[] = [
  { label: 'A', bottleId: 'b1', bottleName: "Jefferson's" },
  { label: 'B', bottleId: 'b2', bottleName: 'Stagg' },
  { label: 'C', bottleId: 'b3', bottleName: 'Eagle Rare' },
]

function response(pourLabel: string, fipScore: number, status: BlindTastingResponse['status'] = 'locked'): BlindTastingResponse {
  return { pourLabel, fipScore, status, updatedAt: Date.now() }
}

function ranking(order: string[], status: BlindFinalRanking['status'] = 'locked'): BlindFinalRanking {
  return { order, status, updatedAt: Date.now() }
}

describe('computeRevealHighlights', () => {
  it('matches the spec example: Pour B (Stagg) 9.2, Pour A (Jefferson’s) 8.8, Pour C (Eagle Rare) 8.4', () => {
    const responsesByUid = {
      'user-1': [response('A', 8.8), response('B', 9.2), response('C', 8.4)],
    }
    const rankingsByUid = { 'user-1': ranking(['B', 'A', 'C']) }

    const highlights = computeRevealHighlights(pours, responsesByUid, rankingsByUid)

    expect(highlights.groupRanking.map((p) => p.bottleName)).toEqual(['Stagg', "Jefferson's", 'Eagle Rare'])
    expect(highlights.groupAverageScores.map((p) => p.bottleName)).toEqual(['Stagg', "Jefferson's", 'Eagle Rare'])
    expect(highlights.groupAverageScores[0]).toMatchObject({ bottleName: 'Stagg', avgScore: 9.2 })
  })

  it('averages scores and ranks across multiple participants', () => {
    const responsesByUid = {
      'user-1': [response('A', 9.0), response('B', 8.0)],
      'user-2': [response('A', 7.0), response('B', 8.0)],
    }
    const rankingsByUid = {
      'user-1': ranking(['A', 'B']),
      'user-2': ranking(['B', 'A']),
    }

    const highlights = computeRevealHighlights(pours, responsesByUid, rankingsByUid)

    const pourA = highlights.groupAverageScores.find((p) => p.label === 'A')
    const pourB = highlights.groupAverageScores.find((p) => p.label === 'B')
    expect(pourA?.avgScore).toBe(8.0)
    expect(pourB?.avgScore).toBe(8.0)

    const rankA = highlights.groupRanking.find((p) => p.label === 'A')
    const rankB = highlights.groupRanking.find((p) => p.label === 'B')
    expect(rankA?.avgRank).toBe(1.5)
    expect(rankB?.avgRank).toBe(1.5)
  })

  it('ignores in-progress (unlocked) responses and rankings', () => {
    const responsesByUid = {
      'user-1': [response('A', 9.9, 'in-progress'), response('B', 8.0)],
    }
    const rankingsByUid = { 'user-1': ranking(['A', 'B'], 'in-progress') }

    const highlights = computeRevealHighlights(pours, responsesByUid, rankingsByUid)

    expect(highlights.groupAverageScores.map((p) => p.label)).toEqual(['B'])
    expect(highlights.groupRanking).toEqual([])
  })

  it('finds the closest matchup by smallest average-score gap', () => {
    const responsesByUid = {
      'user-1': [response('A', 8.8), response('B', 9.2), response('C', 7.9)],
    }
    const highlights = computeRevealHighlights(pours, responsesByUid, {})

    expect(highlights.closestMatchup).toBeDefined()
    expect(new Set([highlights.closestMatchup!.a.label, highlights.closestMatchup!.b.label])).toEqual(new Set(['A', 'B']))
    expect(highlights.closestMatchup!.diff).toBeCloseTo(0.4, 5)
  })

  it('omits closest matchup when fewer than two pours have a score', () => {
    const responsesByUid = { 'user-1': [response('A', 8.8)] }
    const highlights = computeRevealHighlights(pours, responsesByUid, {})
    expect(highlights.closestMatchup).toBeUndefined()
  })

  it('finds the most divisive pour by widest individual score spread', () => {
    const responsesByUid = {
      'user-1': [response('A', 9.5), response('B', 8.0)],
      'user-2': [response('A', 9.6), response('B', 5.0)],
    }
    const highlights = computeRevealHighlights(pours, responsesByUid, {})

    expect(highlights.mostDivisive).toMatchObject({ pour: { label: 'B' }, spread: 3.0 })
  })

  it('omits most divisive when no pour was scored by two or more people (e.g. Solo Blind)', () => {
    const responsesByUid = { 'user-1': [response('A', 8.8), response('B', 9.2)] }
    const highlights = computeRevealHighlights(pours, responsesByUid, {})
    expect(highlights.mostDivisive).toBeUndefined()
  })

  it('omits most divisive when every shared pour was scored identically', () => {
    const responsesByUid = {
      'user-1': [response('A', 8.0)],
      'user-2': [response('A', 8.0)],
    }
    const highlights = computeRevealHighlights(pours, responsesByUid, {})
    expect(highlights.mostDivisive).toBeUndefined()
  })

  it('flags a surprise when the highest-scoring pour isn’t the group’s top-ranked pour', () => {
    const responsesByUid = { 'user-1': [response('A', 9.5), response('B', 8.0)] }
    const rankingsByUid = { 'user-1': ranking(['B', 'A']) }

    const highlights = computeRevealHighlights(pours, responsesByUid, rankingsByUid)

    expect(highlights.surprise).toMatchObject({
      scoreLeader: { label: 'A' },
      rankLeader: { label: 'B' },
    })
  })

  it('omits surprise when the top score and top rank agree', () => {
    const responsesByUid = { 'user-1': [response('A', 9.5), response('B', 8.0)] }
    const rankingsByUid = { 'user-1': ranking(['A', 'B']) }

    const highlights = computeRevealHighlights(pours, responsesByUid, rankingsByUid)

    expect(highlights.surprise).toBeUndefined()
  })

  it('returns empty highlights when there is no data at all', () => {
    const highlights = computeRevealHighlights(pours, {}, {})
    expect(highlights.groupRanking).toEqual([])
    expect(highlights.groupAverageScores).toEqual([])
    expect(highlights.closestMatchup).toBeUndefined()
    expect(highlights.mostDivisive).toBeUndefined()
    expect(highlights.surprise).toBeUndefined()
  })
})
