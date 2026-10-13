import type { Bottle, Pour } from '../../../data/types'

// AXE Insights engine: deterministic, pure, and shared. The same compiled
// code runs in the browser (to show / reconcile) and in Cloud Functions
// (functions/generated/axeInsightsEngine.js, the authoritative copy that
// writes users/{uid}/axeInsights/current). It never calls a model: every
// number in an insight is computed here from the user's own records.

export type InsightCategory =
  | 'palate-evolution'
  | 'flavor-discovery'
  | 'collection-discovery'
  | 'bottle-rediscovery'
  | 'blind-discovery'
  | 'journey-milestone'

export const INSIGHT_CATEGORIES: readonly InsightCategory[] = [
  'palate-evolution',
  'flavor-discovery',
  'collection-discovery',
  'bottle-rediscovery',
  'blind-discovery',
  'journey-milestone',
]

// 'descriptive': a plain fact about what happened (any sample size).
// 'tentative': a possible pattern, worded as "suggests"/"may".
// 'established': a pattern with enough evidence to state plainly.
// Assigned only by the rules in confidence.ts, never by a model.
export type InsightConfidence = 'descriptive' | 'tentative' | 'established'

// One verified number or string an insight may cite. `key` is how an AI
// explanation references it; `value` is what it must match exactly.
export interface InsightFact {
  key: string
  label: string
  value: number | string
  unit?: 'proof' | 'points' | 'pours' | 'bottles' | 'days' | 'percent'
}

// The follow-ups the UI may offer for an insight. A model may only pick
// from the candidate's own `actions`; it can never invent a new one.
export type InsightActionId = 'open-palate' | 'open-bottle' | 'open-collection' | 'log-pour' | 'open-blind' | 'ask-axe'

export interface InsightAction {
  id: InsightActionId
  label: string
  bottleId?: string
  roomId?: string
}

export interface InsightWindow {
  // Calendar dates (YYYY-MM-DD) of the records analyzed, inclusive.
  from?: string
  to?: string
  // Human description, e.g. "your last 3 pours vs. your first 3".
  label: string
}

export interface InsightEvidence {
  pourIds: string[]
  bottleIds: string[]
  roomIds: string[]
}

export interface InsightCopy {
  headline: string
  body: string
  expanded?: string
}

export interface InsightCandidate {
  // Stable identity: category + kind + subject. The same pattern keeps the
  // same id as its numbers move, so it can be recognized (not re-surfaced
  // as "new") across recalculations.
  id: string
  category: InsightCategory
  kind: string
  facts: InsightFact[]
  sampleSize: number
  confidence: InsightConfidence
  window: InsightWindow
  evidence: InsightEvidence
  // Bottles the insight is about (a subset of evidence.bottleIds), used to
  // avoid surfacing the same bottle again too soon.
  subjectBottleIds: string[]
  actions: InsightAction[]
  // Deterministic wording, always valid on its own. AI explanations are
  // optional decoration on top and fall back to this.
  copy: InsightCopy
  // Higher surfaces first. Category weight + confidence + freshness.
  priority: number
}

// A blind tasting, as the signed-in user experienced it: their own locked
// responses and ranking joined with the revealed bottle identities.
export interface BlindTastingResult {
  roomId: string
  roomName?: string
  // Calendar date the room was revealed/completed (YYYY-MM-DD).
  date?: string
  pours: {
    label: string
    bottleId: string
    bottleName: string
    // The user's own blind FIP score for this pour, if they gave one.
    blindScore?: number
    // 1 = favorite in the user's locked final ranking, if they ranked.
    blindRank?: number
  }[]
}

export interface InsightInput {
  bottles: Bottle[]
  pours: Pour[]
  blindTastings?: BlindTastingResult[]
  // The user's local calendar date (YYYY-MM-DD), for "time since" facts.
  today: string
}

export interface CategoryResult {
  category: InsightCategory
  candidates: InsightCandidate[]
}
