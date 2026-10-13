// Public surface of the AXE Insights engine. Pure TypeScript with no
// React, Firebase, or browser dependencies, so Cloud Functions can run the
// identical code (bundled into functions/generated/axeInsightsEngine.js).
export * from './types'
export { EVIDENCE } from './config'
export { normalizeInput, confidenceForSample, confidenceForTrend, daysBetween, isCalendarDate, formatCalendarDate } from './normalize'
export { hash, inputFingerprints, candidateFingerprint, candidatesFingerprint } from './fingerprint'
export {
  AXE_INSIGHTS_SCHEMA_VERSION,
  computeCategoryCandidates,
  rank,
  reconcileInsights,
  type AxeInsightState,
  type ReconcileOptions,
  type ReconcileResult,
  type SurfacedRecord,
} from './select'
