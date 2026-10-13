import type { Bottle, Pour } from '../../../data/types'
import { EVIDENCE } from './config'
import type { InsightConfidence, InsightInput } from './types'

// Pour dates are calendar days (YYYY-MM-DD) chosen by the user: the day
// the tasting happened, which may be backdated or edited later. That date,
// never a document timestamp, places a pour in time. Values that aren't a
// real calendar date are left out of anything time-based.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = DATE_ONLY.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const probe = new Date(Date.UTC(y, mo - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d
}

// Whole days between two calendar dates, independent of timezone and DST.
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000)
}

function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
}

export interface NormalizedInput {
  bottles: Bottle[]
  bottleById: Map<string, Bottle>
  // Every valid pour once (deduplicated by id), oldest first by tasting
  // date, ties kept in saved order. Pours without a valid calendar date
  // are excluded: they can't be placed in any window.
  pours: Pour[]
  today: string
}

// Cleans the raw input once so every category works from the same rules:
// a pour id counts once even if the record appears twice, ratings outside
// FIP's 0–10 scale are dropped, and bottles keep their saved status.
export function normalizeInput(input: InsightInput): NormalizedInput {
  const bottles: Bottle[] = []
  const bottleById = new Map<string, Bottle>()
  for (const bottle of input.bottles ?? []) {
    if (!bottle || typeof bottle.id !== 'string' || bottleById.has(bottle.id)) continue
    bottleById.set(bottle.id, bottle)
    bottles.push(bottle)
  }

  const seen = new Set<string>()
  const pours: Pour[] = []
  for (const pour of input.pours ?? []) {
    if (!pour || typeof pour.id !== 'string' || seen.has(pour.id)) continue
    if (typeof pour.bottleId !== 'string' || !isValidRating(pour.rating) || !isCalendarDate(pour.date)) continue
    seen.add(pour.id)
    pours.push(pour)
  }
  pours.sort((a, b) => a.date.localeCompare(b.date))

  const today = isCalendarDate(input.today) ? input.today : new Date().toISOString().slice(0, 10)
  return { bottles, bottleById, pours, today }
}

// Confidence comes from sample size only, under the thresholds in config.
export function confidenceForSample(sampleSize: number): InsightConfidence {
  if (sampleSize >= EVIDENCE.establishedMin) return 'established'
  if (sampleSize >= EVIDENCE.tentativeMin) return 'tentative'
  return 'descriptive'
}

// For a two-period comparison, the weaker period decides.
export function confidenceForTrend(olderCount: number, recentCount: number): InsightConfidence | undefined {
  const weakest = Math.min(olderCount, recentCount)
  if (weakest < EVIDENCE.trendMinPerPeriod) return undefined
  return weakest >= EVIDENCE.establishedMin ? 'established' : 'tentative'
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function uniq<T>(values: T[]): T[] {
  return [...new Set(values)]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "Aug 10, 2026" straight from the calendar date's parts: no Date object,
// so no timezone can shift the day. Copy states dates, never "N days ago",
// because a cached insight must stay true on the day it's read.
export function formatCalendarDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`
}
