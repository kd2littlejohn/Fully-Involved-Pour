import { describe, expect, it } from 'vitest'
import { buildQuickPourInput } from './buildQuickPourInput'

describe('buildQuickPourInput', () => {
  it('carries through bottleId, date, mood, and flavors as given', () => {
    const input = buildQuickPourInput({
      bottleId: 'b1',
      date: '2026-08-14',
      reactionLabel: 'Love it',
      score: 9.2,
      flavors: ['Vanilla', 'Oak'],
    })

    expect(input.bottleId).toBe('b1')
    expect(input.date).toBe('2026-08-14')
    expect(input.mood).toBe('Love it')
    expect(input.fip.palateFlavors).toEqual(['Vanilla', 'Oak'])
    expect(input.fip.noseAromas).toEqual([])
  })

  it('sets rating and fip.total to the given score', () => {
    const input = buildQuickPourInput({ bottleId: 'b1', date: '2026-08-14', reactionLabel: 'Love it', score: 9.2, flavors: [] })

    expect(input.rating).toBe(9.2)
    expect(input.fip.total).toBe(9.2)
  })

  it('splits the score across components so they sum back to the total exactly', () => {
    for (const score of [0, 2.3, 4, 6.5, 8, 9.2, 10]) {
      const input = buildQuickPourInput({ bottleId: 'b1', date: '2026-08-14', reactionLabel: 'x', score, flavors: [] })
      const { nose, palate, finish, complexity, value } = input.fip
      const sum = Math.round((nose + palate + finish + complexity + value) * 10) / 10
      expect(sum).toBe(input.fip.total)
    }
  })

  it('keeps every component within its own max, even at the extremes', () => {
    for (const score of [0, 10]) {
      const input = buildQuickPourInput({ bottleId: 'b1', date: '2026-08-14', reactionLabel: 'x', score, flavors: [] })
      expect(input.fip.nose).toBeGreaterThanOrEqual(0)
      expect(input.fip.nose).toBeLessThanOrEqual(2.5)
      expect(input.fip.value).toBeGreaterThanOrEqual(0)
      expect(input.fip.value).toBeLessThanOrEqual(1.0)
    }
  })

  it('clamps an out-of-range score into 0-10', () => {
    expect(buildQuickPourInput({ bottleId: 'b1', date: '2026-08-14', reactionLabel: 'x', score: 15, flavors: [] }).rating).toBe(10)
    expect(buildQuickPourInput({ bottleId: 'b1', date: '2026-08-14', reactionLabel: 'x', score: -3, flavors: [] }).rating).toBe(0)
  })

  it('leaves buyAgain, occasion, and unset optional fields unset', () => {
    const input = buildQuickPourInput({ bottleId: 'b1', date: '2026-08-14', reactionLabel: 'Love it', score: 9.2, flavors: [] })

    expect(input.buyAgain).toBeUndefined()
    expect(input.occasion).toBeUndefined()
    expect(input.companion).toBeUndefined()
    expect(input.notes).toBeUndefined()
    expect(input.location).toBeUndefined()
    expect(input.memoryPhoto).toBeUndefined()
  })

  it('carries through notes, companion, location, and memoryPhoto when given', () => {
    const input = buildQuickPourInput({
      bottleId: 'b1',
      date: '2026-08-14',
      reactionLabel: 'Love it',
      score: 9.2,
      flavors: [],
      notes: 'Great porch pour',
      companion: 'Dave',
      location: 'Back porch',
      memoryPhoto: { url: 'https://example.com/photo.jpg', storagePath: 'pour-photos/u1/1-photo.jpg', createdAt: 1 },
    })

    expect(input.notes).toBe('Great porch pour')
    expect(input.companion).toBe('Dave')
    expect(input.location).toBe('Back porch')
    expect(input.memoryPhoto).toEqual({ url: 'https://example.com/photo.jpg', storagePath: 'pour-photos/u1/1-photo.jpg', createdAt: 1 })
  })
})
