import type { InsightCategory, InsightConfidence } from './types'

// Evidence thresholds. Starting defaults chosen to match the rest of FIP
// (Your Palate's 3-pour baseline, its 3-vs-3 evolution comparison), not
// statistically validated guarantees. Tune here, in one place.
export const EVIDENCE = {
  // Below this many relevant records, only descriptive facts are allowed.
  tentativeMin: 3,
  // At or above this, a pattern may be stated without hedging.
  establishedMin: 6,
  // Trend comparisons need at least this many records in EACH period.
  trendMinPerPeriod: 3,
} as const

// A rating change this large (FIP points) between two pours of the same
// bottle counts as a "substantially different impression".
export const REVISIT_RATING_DELTA = 1.5

// Bottle Rediscovery: a bottle you rated at least this well...
export const REDISCOVERY_MIN_RATING = 8.0
// ...and haven't poured in at least this many days.
export const REDISCOVERY_MIN_DAYS = 60

// Preference lead rule: PREFERENCE_MIN_MARGIN in yourPalate/selectors.ts
// (shared with Your Palate).

// Blind Room: blind and sighted preferences must disagree by at least this
// many FIP points (sighted averages) before AXE calls it out.
export const BLIND_SIGHTED_MIN_GAP = 0.5

// A milestone is only news while it's recent.
export const MILESTONE_FRESH_DAYS = 30

// A surfaced insight about a bottle isn't offered again for this long, so
// the same bottle doesn't keep coming back.
export const SURFACE_COOLDOWN_DAYS = 21

// Evidence ids kept per candidate (the most recent). sampleSize still
// reports the full count; this only bounds the cached document and any
// payload built from it.
export const MAX_EVIDENCE_IDS = 40

// How many candidate summaries to keep per category in the cache.
export const MAX_CANDIDATES_PER_CATEGORY = 3

export const CATEGORY_WEIGHT: Record<InsightCategory, number> = {
  'journey-milestone': 60,
  'blind-discovery': 55,
  'flavor-discovery': 50,
  'palate-evolution': 45,
  'bottle-rediscovery': 35,
  'collection-discovery': 30,
}

export const CONFIDENCE_WEIGHT: Record<InsightConfidence, number> = {
  established: 20,
  tentative: 10,
  descriptive: 0,
}
