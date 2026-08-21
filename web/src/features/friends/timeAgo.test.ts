import { describe, expect, it } from 'vitest'
import { timeAgo } from './timeAgo'

describe('timeAgo', () => {
  const now = new Date('2026-01-15T12:00:00Z').getTime()

  it('reports seconds-old as "just now"', () => {
    expect(timeAgo(now - 30_000, now)).toBe('just now')
  })

  it('reports minutes', () => {
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5m ago')
  })

  it('reports hours', () => {
    expect(timeAgo(now - 2 * 60 * 60_000, now)).toBe('2h ago')
  })

  it('reports days', () => {
    expect(timeAgo(now - 3 * 24 * 60 * 60_000, now)).toBe('3d ago')
  })

  it('reports weeks', () => {
    expect(timeAgo(now - 10 * 24 * 60 * 60_000, now)).toBe('1w ago')
  })

  it('never goes negative for a future timestamp', () => {
    expect(timeAgo(now + 60_000, now)).toBe('just now')
  })
})
