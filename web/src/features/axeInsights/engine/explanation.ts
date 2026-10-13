import { formatCalendarDate, isCalendarDate } from './normalize'
import type { InsightActionId, InsightCandidate, InsightFact } from './types'

// AXE explanation layer: the model may rephrase a verified insight in AXE's
// voice, nothing more. This module builds the minimal payload the model
// sees and validates what comes back. Anything that fails validation is
// discarded and the engine's deterministic copy is used instead.

// Bump when the prompt, payload shape, or validation rules change, so
// cached explanations made under the old rules are regenerated.
export const EXPLANATION_VERSION = 1

export const EXPLANATION_LIMITS = { headline: 100, body: 320, expanded: 600 } as const

export interface InsightExplanation {
  headline: string
  body: string
  expanded?: string
  // Fact keys the text relies on (must be the candidate's own).
  factKeys: string[]
  actionId?: InsightActionId
}

// Exactly what the model is given: no profile, no raw records, no ids
// beyond what's needed to cite facts and pick an allowed action.
export interface ExplanationPayload {
  category: InsightCandidate['category']
  kind: string
  confidence: InsightCandidate['confidence']
  sampleSize: number
  period: string
  facts: InsightFact[]
  bottles: string[]
  allowedActions: { id: InsightActionId; label: string }[]
  reference: { headline: string; body: string }
}

export function buildExplanationPayload(candidate: InsightCandidate, bottleNames: string[]): ExplanationPayload {
  return {
    category: candidate.category,
    kind: candidate.kind,
    confidence: candidate.confidence,
    sampleSize: candidate.sampleSize,
    period: [candidate.window.label, candidate.window.from && candidate.window.to ? `(${candidate.window.from} to ${candidate.window.to})` : '']
      .filter(Boolean)
      .join(' '),
    facts: candidate.facts,
    bottles: bottleNames.slice(0, 8),
    allowedActions: candidate.actions.map((a) => ({ id: a.id, label: a.label })),
    reference: { headline: candidate.copy.headline, body: candidate.copy.body },
  }
}

export function deterministicExplanation(candidate: InsightCandidate): InsightExplanation {
  return {
    headline: candidate.copy.headline,
    body: candidate.copy.body,
    expanded: candidate.copy.expanded,
    factKeys: candidate.facts.map((f) => f.key),
    actionId: candidate.actions[0]?.id,
  }
}

// Kinds whose facts themselves establish a preference (rating-backed).
const PREFERENCE_KINDS = new Set(['style-preference', 'top-rated-flavors', 'blind-vs-sighted'])

function allowsPreference(candidate: InsightCandidate): boolean {
  if (PREFERENCE_KINDS.has(candidate.kind)) return true
  return candidate.kind === 'proof-shift' && candidate.facts.some((f) => f.key === 'bestProofRange')
}

const PREFERENCE_CLAIM =
  /\b(you(?:'ve|’ve)? (?:really |clearly |obviously )?(?:prefer|love|favou?r|adore)|your (?:favou?rites?|preferences?|go-to|palate prefers)|preferred|preference|you like [^.]{0,40}\b(?:best|most))\b/i
const CERTAINTY = /\b(always|never|definitely|certainly|clearly|undoubtedly|without (?:a )?doubt|proves?|proven|guaranteed)\b/i
const CLAIMS_EDIT = /\b(?:I|AXE)(?:'ve|’ve| have)? (?:added|logged|updated|deleted|removed|changed|saved|edited|recorded)\b/i
const PERCENT = /%|\bpercent\b/i
const NUMBER = /\d+(?:\.\d+)?/g
const NUMBER_WORDS: Record<string, number | null> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, dozen: 12, twenty: 20, hundred: 100, thousand: 1000,
  half: null, twice: 2, double: 2, triple: 3, couple: 2, few: null, several: null,
}
// Vague quantity words that imply a count the facts may not support.
const VAGUE_QUANTITY = new Set(['half', 'few', 'several'])

function allowedNumbers(candidate: InsightCandidate): Set<string> {
  const out = new Set<string>([String(candidate.sampleSize)])
  // Exact values only (9 may read "9" or "9.0"). No rounding: allowing 7
  // for a fact of 7.2 would let an invented "7 pours" through.
  const add = (n: number) => {
    out.add(String(n))
    out.add(n.toFixed(1))
  }
  for (const f of candidate.facts) {
    if (typeof f.value === 'number') add(f.value)
    else {
      for (const n of f.value.match(NUMBER) ?? []) out.add(String(Number(n)))
      if (isCalendarDate(f.value)) {
        // "Aug 1, 2026" style mentions of a date fact.
        for (const n of formatCalendarDate(f.value).match(NUMBER) ?? []) out.add(n)
      }
    }
  }
  if (candidate.window.from) for (const n of formatCalendarDate(candidate.window.from).match(NUMBER) ?? []) out.add(n)
  if (candidate.window.to) for (const n of formatCalendarDate(candidate.window.to).match(NUMBER) ?? []) out.add(n)
  return out
}

function stringFacts(candidate: InsightCandidate): string[] {
  return candidate.facts.filter((f) => typeof f.value === 'string').map((f) => String(f.value).toLowerCase())
}

export type ExplanationRejection =
  | 'not-json'
  | 'bad-shape'
  | 'too-long'
  | 'unknown-fact-key'
  | 'disallowed-action'
  | 'unsupported-number'
  | 'unsupported-quantity'
  | 'unsupported-percent'
  | 'unsupported-bottle'
  | 'unsupported-preference'
  | 'overstated-certainty'
  | 'claims-edit'

export type ExplanationValidation = { ok: true; explanation: InsightExplanation } | { ok: false; reasons: ExplanationRejection[] }

// Pulls the first JSON object out of a model reply (tolerating a code
// fence or a stray sentence around it).
export function parseExplanationJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

export interface ValidationContext {
  // Every bottle name in the user's collection. Naming one that isn't part
  // of this insight is an invented reference.
  collectionBottleNames: string[]
  // Bottle names that belong to this insight (its evidence).
  insightBottleNames: string[]
}

export function validateExplanation(raw: unknown, candidate: InsightCandidate, ctx: ValidationContext): ExplanationValidation {
  if (raw === undefined) return { ok: false, reasons: ['not-json'] }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['bad-shape'] }
  const r = raw as Record<string, unknown>
  const headline = typeof r.headline === 'string' ? r.headline.trim() : ''
  const body = typeof r.body === 'string' ? r.body.trim() : ''
  const expanded = typeof r.expanded === 'string' && r.expanded.trim() ? r.expanded.trim() : undefined
  const factKeys = Array.isArray(r.factKeys) ? r.factKeys : null
  const actionId = r.actionId === undefined || r.actionId === null || r.actionId === '' ? undefined : r.actionId
  if (!headline || !body || !factKeys || factKeys.length === 0 || !factKeys.every((k) => typeof k === 'string')) {
    return { ok: false, reasons: ['bad-shape'] }
  }

  const reasons = new Set<ExplanationRejection>()
  if (headline.length > EXPLANATION_LIMITS.headline || body.length > EXPLANATION_LIMITS.body || (expanded?.length ?? 0) > EXPLANATION_LIMITS.expanded) {
    reasons.add('too-long')
  }
  const knownKeys = new Set(candidate.facts.map((f) => f.key))
  if (!(factKeys as string[]).every((k) => knownKeys.has(k))) reasons.add('unknown-fact-key')
  if (actionId !== undefined && !candidate.actions.some((a) => a.id === actionId)) reasons.add('disallowed-action')

  const text = [headline, body, expanded ?? ''].join('\n')
  const lower = text.toLowerCase()

  const numbers = allowedNumbers(candidate)
  for (const n of text.match(NUMBER) ?? []) {
    if (!numbers.has(n) && !numbers.has(String(Number(n)))) reasons.add('unsupported-number')
  }
  for (const word of lower.match(/\b[a-z]+\b/g) ?? []) {
    if (!(word in NUMBER_WORDS)) continue
    const value = NUMBER_WORDS[word]
    if (word === 'one') continue // "one" is too common in ordinary speech to police
    if (VAGUE_QUANTITY.has(word) || value === null || !numbers.has(String(value))) reasons.add('unsupported-quantity')
  }
  if (PERCENT.test(text) && !candidate.facts.some((f) => f.unit === 'percent')) reasons.add('unsupported-percent')

  const allowedNames = new Set([...ctx.insightBottleNames.map((n) => n.toLowerCase()), ...stringFacts(candidate)])
  for (const name of ctx.collectionBottleNames) {
    const n = name.trim().toLowerCase()
    if (n.length < 3 || allowedNames.has(n)) continue
    // A collection bottle that isn't part of this insight. (Skip names that
    // are contained in an allowed name, e.g. "Weller" inside "Weller 12".)
    if ([...allowedNames].some((a) => a.includes(n))) continue
    if (new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) reasons.add('unsupported-bottle')
  }

  if (!allowsPreference(candidate) && PREFERENCE_CLAIM.test(text)) reasons.add('unsupported-preference')
  if (candidate.confidence !== 'established' && CERTAINTY.test(text)) reasons.add('overstated-certainty')
  if (CLAIMS_EDIT.test(text)) reasons.add('claims-edit')

  if (reasons.size > 0) return { ok: false, reasons: [...reasons] }
  return {
    ok: true,
    explanation: { headline, body, expanded, factKeys: factKeys as string[], actionId: actionId as InsightActionId | undefined },
  }
}
