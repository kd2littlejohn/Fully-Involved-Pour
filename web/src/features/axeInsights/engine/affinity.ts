import { getCategoryAffinity, getProofAffinity, type CategoryAffinity, type ProofAffinity } from '../../yourPalate/selectors'
import type { NormalizedInput } from './normalize'

// Thin adapters over Your Palate's own affinity selectors, which apply the
// shared PREFERENCE_MIN_MARGIN lead rule. AXE never computes preference
// itself, so Your Palate, Profile and AXE always agree.

export type SupportedProofAffinity = ProofAffinity

export interface SupportedStyleAffinity extends CategoryAffinity {
  averageRating: number
  othersAverage: number
}

export function supportedProofAffinity({ bottles, pours }: NormalizedInput): SupportedProofAffinity | undefined {
  return getProofAffinity(bottles, pours)
}

export function supportedStyleAffinity({ bottles, pours }: NormalizedInput): SupportedStyleAffinity | undefined {
  const affinity = getCategoryAffinity(bottles, pours)
  if (affinity?.mode !== 'rating-supported' || affinity.averageRating === undefined || affinity.othersAverage === undefined) return undefined
  return { ...affinity, averageRating: affinity.averageRating, othersAverage: affinity.othersAverage }
}
