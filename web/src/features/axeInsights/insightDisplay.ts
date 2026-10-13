import { formatCalendarDate, isCalendarDate, type InsightCandidate, type InsightCategory, type InsightFact } from './engine'

// Presentation of verified insight data. Every value shown comes straight
// from the engine's facts; this only formats them.

export const CATEGORY_LABEL: Record<InsightCategory, string> = {
  'palate-evolution': 'Palate Evolution',
  'flavor-discovery': 'Flavor Discovery',
  'collection-discovery': 'From Your Bar',
  'bottle-rediscovery': 'Worth a Revisit',
  'blind-discovery': 'Blind Room',
  'journey-milestone': 'Milestone',
}

export function formatFactValue(fact: InsightFact): string {
  const { value, unit } = fact
  if (typeof value === 'string') return isCalendarDate(value) ? formatCalendarDate(value) : value
  switch (unit) {
    case 'points':
      return value.toFixed(1)
    case 'proof':
      return `${value} proof`
    case 'percent':
      return `${value}%`
    case 'pours':
      return `${value} ${value === 1 ? 'pour' : 'pours'}`
    case 'bottles':
      return `${value} ${value === 1 ? 'bottle' : 'bottles'}`
    case 'days':
      return `${value} ${value === 1 ? 'day' : 'days'}`
    default:
      return String(value)
  }
}

// Plain-language confidence, from the engine's evidence rules only.
export function confidenceText(candidate: InsightCandidate): string {
  const n = candidate.sampleSize
  const records = `${n} ${n === 1 ? 'record' : 'records'}`
  switch (candidate.confidence) {
    case 'established':
      return `A consistent pattern across ${records}.`
    case 'tentative':
      return `An early pattern from ${records}. Worth watching as you log more.`
    default:
      return n > 1 ? `What happened, from ${records}. Not a pattern yet.` : 'What happened. Not a pattern yet.'
  }
}

export function periodText(candidate: InsightCandidate): string {
  const { label, from, to } = candidate.window
  if (from && to && from !== to) return `${label} (${formatCalendarDate(from)} to ${formatCalendarDate(to)})`
  if (from) return `${label} (${formatCalendarDate(from)})`
  return label
}
