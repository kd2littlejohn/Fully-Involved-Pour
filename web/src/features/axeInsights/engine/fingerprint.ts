import type { Bottle, Pour } from '../../../data/types'
import type { BlindTastingResult, InsightCandidate, InsightCategory, InsightInput } from './types'

// Short, stable content hashes. Used to tell whether a category's inputs
// changed (invalidation) and whether its candidates changed (whether
// anything is worth saving). Not a security boundary.

// Deterministic JSON: object keys sorted, undefined dropped.
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stable(v))).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
}

// 64-bit FNV-1a, as two 32-bit halves (Math.imul keeps it exact in JS).
export function hash(value: unknown): string {
  const text = stable(value)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x811c9dc5)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}

// Only the fields each category reads. A change anywhere else (a photo, a
// purchase price, a greeting name) leaves every fingerprint untouched, so
// nothing recalculates.
const ratingSlice = (p: Pour) => [p.id, p.bottleId, p.date, p.rating]
const flavorSlice = (p: Pour) => [
  ...ratingSlice(p),
  p.fip ? [p.fip.noseAromas, p.fip.palateFlavors, p.fip.finishTags, p.fip.noseNotes, p.fip.palateNotes, p.fip.finishNotes, p.fip.complexityNotes] : null,
]
const componentSlice = (p: Pour) => [
  ...ratingSlice(p),
  p.fip ? [p.fip.nose, p.fip.palate, p.fip.finish, p.fip.complexity, p.fip.value] : null,
]
const styleSlice = (b: Bottle) => [b.id, b.type, b.proof]
const shelfSlice = (b: Bottle) => [b.id, b.name, b.status, b.quantity, b.type, b.proof]
const blindSlice = (blinds: BlindTastingResult[] | undefined) => blinds ?? []

export function inputFingerprints(input: InsightInput): Record<InsightCategory, string> {
  const pours = input.pours ?? []
  const bottles = input.bottles ?? []
  return {
    'palate-evolution': hash(['pe1', pours.map(componentSlice), bottles.map(styleSlice)]),
    'flavor-discovery': hash(['fd1', pours.map(flavorSlice)]),
    'collection-discovery': hash(['cd1', pours.map(ratingSlice), bottles.map(shelfSlice)]),
    // Time matters here: "a while since" and freshness windows move daily.
    'bottle-rediscovery': hash(['br1', pours.map(ratingSlice), bottles.map(shelfSlice), input.today]),
    'blind-discovery': hash(['bd1', blindSlice(input.blindTastings), pours.map(ratingSlice), input.today]),
    'journey-milestone': hash(['jm1', pours.map(flavorSlice), bottles.map((b) => [b.id, b.name]), blindSlice(input.blindTastings), input.today]),
  }
}

// What a candidate says, without its ranking weight.
export function candidateFingerprint(candidate: InsightCandidate): string {
  const { priority: _priority, ...content } = candidate
  return hash(content)
}

export function candidatesFingerprint(candidates: InsightCandidate[]): string {
  return hash(candidates.map(candidateFingerprint))
}
