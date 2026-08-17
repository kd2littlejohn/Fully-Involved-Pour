import { describe, expect, it } from 'vitest'
import { getJourneyCardVariant, getJourneyFeedEntries } from './journeyCardVariant'
import type { Bottle, Pour } from '../../data/types'

function minFip(rating: number) {
  return { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: rating, noseAromas: [], palateFlavors: [] }
}

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  return { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1, ...overrides }
}

function pour(overrides: Partial<Pour> = {}): Pour {
  return { id: 'p1', bottleId: 'b1', date: '2026-07-01', rating: 8.0, fip: minFip(8.0), ...overrides }
}

describe('getJourneyCardVariant', () => {
  it('is standard for a normal pour', () => {
    expect(getJourneyCardVariant(pour(), bottle(), [pour()])).toEqual({ variant: 'standard' })
  })

  it('stays standard for a first pour even with no other qualifying signal', () => {
    const p = pour({ id: 'first', rating: 7.5 })
    expect(getJourneyCardVariant(p, bottle(), [p])).toEqual({ variant: 'standard' })
  })

  it('is featured when the pour is manually marked isFeatured', () => {
    const p = pour({ isFeatured: true, rating: 6.0 })
    expect(getJourneyCardVariant(p, bottle(), [p])).toEqual({ variant: 'featured', reason: 'manual' })
  })

  it('is featured for the bottle-kill pour of a finished bottle', () => {
    const b = bottle({ status: 'finished' })
    const earlier = pour({ id: 'p1', date: '2026-06-01', rating: 7.0 })
    const last = pour({ id: 'p2', date: '2026-07-01', rating: 7.0 })
    expect(getJourneyCardVariant(last, b, [earlier, last])).toEqual({ variant: 'featured', reason: 'bottle-kill' })
  })

  it('does not feature an earlier pour of a finished bottle, only its last one', () => {
    const b = bottle({ status: 'finished' })
    const earlier = pour({ id: 'p1', date: '2026-06-01', rating: 7.0 })
    const last = pour({ id: 'p2', date: '2026-07-01', rating: 7.0 })
    expect(getJourneyCardVariant(earlier, b, [earlier, last])).toEqual({ variant: 'standard' })
  })

  it('is featured for a Hall of Fame score', () => {
    const p = pour({ rating: 9.6 })
    expect(getJourneyCardVariant(p, bottle(), [p])).toEqual({ variant: 'featured', reason: 'hall-of-fame' })
  })

  it('is standard just below the Hall of Fame threshold', () => {
    const p = pour({ rating: 9.4 })
    expect(getJourneyCardVariant(p, bottle(), [p])).toEqual({ variant: 'standard' })
  })
})

describe('getJourneyFeedEntries', () => {
  it('skips a pour whose bottle no longer exists', () => {
    const entries = getJourneyFeedEntries([pour({ bottleId: 'missing' })], [bottle()])
    expect(entries).toEqual([])
  })

  it('sorts newest first', () => {
    const older = pour({ id: 'p1', date: '2026-06-01' })
    const newer = pour({ id: 'p2', date: '2026-07-01' })
    const entries = getJourneyFeedEntries([older, newer], [bottle()])
    expect(entries.map((e) => e.pour.id)).toEqual(['p2', 'p1'])
  })

  it('never renders two featured cards back to back, demoting the second to standard', () => {
    const first = pour({ id: 'p1', date: '2026-07-02', rating: 9.6 })
    const second = pour({ id: 'p2', date: '2026-07-01', rating: 9.7 })
    const entries = getJourneyFeedEntries([first, second], [bottle()])
    expect(entries[0]).toMatchObject({ variant: 'featured', reason: 'hall-of-fame' })
    expect(entries[1]).toMatchObject({ variant: 'standard', reason: undefined })
  })

  it('allows a featured card again once a standard one has broken up the run', () => {
    const a = pour({ id: 'p1', date: '2026-07-03', rating: 9.6 })
    const b = pour({ id: 'p2', date: '2026-07-02', rating: 8.0 })
    const c = pour({ id: 'p3', date: '2026-07-01', rating: 9.7 })
    const entries = getJourneyFeedEntries([a, b, c], [bottle()])
    expect(entries.map((e) => e.variant)).toEqual(['featured', 'standard', 'featured'])
  })
})
