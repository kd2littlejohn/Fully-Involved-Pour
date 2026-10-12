import type { AxePalateInsights } from '../../data/repositories/ai'
import type { Bottle, Pour } from '../../data/types'
import { buildPalateProfile } from '../yourPalate/palateProfile'
import { buildPalateInsightText } from '../yourPalate/palateInsights'
import type { AxeScreen } from './axeContext'

// Screens where AXE talks about the user's palate.
export const PALATE_SCREENS = new Set<AxeScreen>(['home', 'palate', 'pour-recommendation', 'collection', 'discover'])

// The same validated insights Your Palate shows (buildPalateInsightText +
// buildPalateProfile) — AXE never derives its own palate math. Computed
// from data already in memory, only when a question is actually sent.
export function buildAxePalateInsights(bottles: Bottle[], pours: Pour[]): AxePalateInsights {
  const text = buildPalateInsightText(bottles, pours)
  const profile = buildPalateProfile(bottles, pours)
  if (!text) {
    return { pourCount: 0, hasBaseline: false, qualifyingPourCount: 0, maturity: profile.maturity, patterns: [], trends: [] }
  }
  return {
    pourCount: text.stats.pourCount,
    hasBaseline: text.hasBaseline,
    qualifyingPourCount: profile.qualifyingPourCount,
    maturity: profile.maturity,
    summary: text.summaryText,
    patterns: text.tastePatterns,
    trends: [text.evolutionText, text.proofEvolutionText].filter((t): t is string => Boolean(t)),
  }
}
