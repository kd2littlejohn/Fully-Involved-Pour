import { bucketForProof, getCategoryAffinity, getProofAffinity, type CategoryAffinity, type ProofAffinity } from '../../yourPalate/selectors'
import { PREFERENCE_MIN_MARGIN } from './config'
import { average, round1, type NormalizedInput } from './normalize'

// Your Palate's affinity selectors pick the best-rated proof range / style
// among those with 2+ pours, even on a tie. AXE only treats one as a
// preference when it actually beats everything else you've rated by
// PREFERENCE_MIN_MARGIN; otherwise it says nothing about preference.

export interface SupportedProofAffinity extends ProofAffinity {
  othersAverage: number
}

export interface SupportedStyleAffinity extends CategoryAffinity {
  averageRating: number
  othersAverage: number
}

export function supportedProofAffinity({ bottles, pours, bottleById }: NormalizedInput): SupportedProofAffinity | undefined {
  const affinity = getProofAffinity(bottles, pours)
  if (!affinity) return undefined
  const others = pours.filter((p) => {
    const proof = bottleById.get(p.bottleId)?.proof
    return typeof proof === 'number' && bucketForProof(proof) !== affinity.bucketLabel
  })
  if (others.length === 0) return undefined
  const othersAverage = round1(average(others.map((p) => p.rating)))
  return affinity.averageRating - othersAverage >= PREFERENCE_MIN_MARGIN ? { ...affinity, othersAverage } : undefined
}

export function supportedStyleAffinity({ bottles, pours, bottleById }: NormalizedInput): SupportedStyleAffinity | undefined {
  const affinity = getCategoryAffinity(bottles, pours)
  if (affinity?.mode !== 'rating-supported' || affinity.averageRating === undefined) return undefined
  const others = pours.filter((p) => {
    const type = bottleById.get(p.bottleId)?.type?.trim()
    return Boolean(type) && type !== affinity.category
  })
  if (others.length === 0) return undefined
  const othersAverage = round1(average(others.map((p) => p.rating)))
  return affinity.averageRating - othersAverage >= PREFERENCE_MIN_MARGIN
    ? { ...affinity, averageRating: affinity.averageRating, othersAverage }
    : undefined
}
