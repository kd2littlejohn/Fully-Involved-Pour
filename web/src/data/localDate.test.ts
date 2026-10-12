import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { localIsoDate, parseDisplayDate, parseLocalDate, todayLocalIsoDate } from './localDate'

// Tests run in UTC by default, which hides every one of these bugs. A
// timezone west of UTC is where they showed up for real users.
// vi.hoisted runs before the imports, so module-level Intl formatters
// (Timeline, BottleStorySummary) are created in this timezone too.
const tz = vi.hoisted(() => {
  // The app's tsconfig has no Node types, hence the cast.
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
  const previous = env.TZ
  env.TZ = 'America/Los_Angeles'
  return { env, previous }
})
afterAll(() => {
  if (tz.previous === undefined) delete tz.env.TZ
  else tz.env.TZ = tz.previous
})
afterEach(() => {
  vi.useRealTimers()
})

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

describe('local calendar dates', () => {
  it("'today' is the user's own day in the evening, not the next UTC day", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 11, 20, 30)) // Oct 11, 8:30pm Pacific = Oct 12 03:30 UTC
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-12') // the old, wrong value
    expect(todayLocalIsoDate()).toBe('2026-10-11')
  })

  it("'today' is unchanged in the morning too", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 11, 8, 0))
    expect(todayLocalIsoDate()).toBe('2026-10-11')
  })

  it('turns an epoch-ms instant (createdAt) into the local day it happened', () => {
    const addedAt = new Date(2026, 9, 9, 21, 15).getTime() // Oct 9, 9:15pm Pacific = Oct 10 UTC
    expect(localIsoDate(addedAt)).toBe('2026-10-09')
  })

  it('shows a stored YYYY-MM-DD as that same day, not the day before', () => {
    expect(dayFormatter.format(new Date('2026-10-10'))).toBe('Oct 9, 2026') // the old, wrong read
    expect(dayFormatter.format(parseLocalDate('2026-10-10'))).toBe('Oct 10, 2026')
    expect(dayFormatter.format(parseDisplayDate('2026-10-10'))).toBe('Oct 10, 2026')
  })

  it('still reads full timestamps as the instant they are', () => {
    expect(parseDisplayDate('2026-10-10T04:15:00.000Z').getTime()).toBe(Date.UTC(2026, 9, 10, 4, 15))
    expect(dayFormatter.format(parseDisplayDate('2026-10-10T04:15:00.000Z'))).toBe('Oct 9, 2026')
  })

  it('round-trips: a local day written today reads back as the same day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 31, 23, 59))
    expect(dayFormatter.format(parseLocalDate(todayLocalIsoDate()))).toBe('Jan 31, 2026')
  })
})
