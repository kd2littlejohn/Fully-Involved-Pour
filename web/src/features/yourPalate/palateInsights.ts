import type { Bottle, Pour } from '../../data/types'
import { fipTier } from '../fip/tiers'
import { collectionFlavorRadarValues, tastedBottles, topFlavorTags, type FlavorTagRank } from '../flavorRadar/flavorCategories'
import {
  getPalateStats,
  getBuyAgainRate,
  getLoyaltySignal,
  getCategoryAffinity,
  getProofAffinity,
  getTopOccasion,
  getPalateEvolution,
  getProofEvolution,
  getTopRatedFlavorTags,
  type FlavorPreferenceRank,
  type PalateStats,
} from './selectors'

export const BASELINE_MIN_POURS = 3

export interface PalateInsightText {
  stats: PalateStats
  hasBaseline: boolean
  summaryText: string
  /** Flavor Radar values — tasted bottles only. Undefined below the baseline. */
  radarValues?: number[]
  /** "Flavors you've experienced most" — frequency only, tasted bottles only; says nothing about liking. */
  experiencedFlavors: FlavorTagRank[]
  /** "Flavors you tend to prefer" — rating-aware, 8.0+ pours across 2+ different bottles (getTopRatedFlavorTags). */
  preferredFlavors: FlavorPreferenceRank[]
  /** Shown instead of preferred flavors once there's a baseline but not enough high-rated variety yet. */
  preferredFlavorsNote?: string
  tastePatterns: string[]
  evolutionText?: string
  proofEvolutionText?: string
}

export const PREFERRED_FLAVORS_PENDING_NOTE =
  'Rate a few more pours 8+ across different bottles, and we\u2019ll start showing flavors you tend to prefer.'

// The validated, user-facing palate insights — everything Your Palate shows
// (YourPalateSection), built once from the tested selectors. AXE consumes
// this same object (features/sommelier/axePalate.ts), so the screen and AXE
// can never disagree or re-derive their own view. Collection-wide flavor
// measures only count bottles that were actually poured (tastedBottles).
// Undefined when there are no pours at all.
export function buildPalateInsightText(bottles: Bottle[], pours: Pour[]): PalateInsightText | undefined {
  const stats = getPalateStats(pours)
  if (!stats) return undefined

  const pourCount = stats.pourCount
  const hasBaseline = pourCount >= BASELINE_MIN_POURS
  const tier = fipTier(stats.averageScore)

  const categoryAffinity = hasBaseline ? getCategoryAffinity(bottles, pours) : undefined
  const proofAffinity = hasBaseline ? getProofAffinity(bottles, pours) : undefined
  const loyalty = hasBaseline ? getLoyaltySignal(bottles, pours) : undefined
  const buyAgain = hasBaseline ? getBuyAgainRate(pours) : undefined
  const occasion = hasBaseline ? getTopOccasion(pours) : undefined
  const evolution = getPalateEvolution(pours)
  const proofEvolution = getProofEvolution(bottles, pours)
  const tasted = tastedBottles(bottles, pours)
  const radarValues = hasBaseline ? collectionFlavorRadarValues(tasted, pours) : undefined
  const experiencedFlavors = hasBaseline ? topFlavorTags(tasted, pours, 6) : []
  const preferredFlavors = hasBaseline ? getTopRatedFlavorTags(pours) : []
  const preferredFlavorsNote = hasBaseline && preferredFlavors.length === 0 ? PREFERRED_FLAVORS_PENDING_NOTE : undefined

  const tastePatterns: string[] = []
  if (proofAffinity) {
    tastePatterns.push(
      `Your highest-rated pours tend to land around ${proofAffinity.bucketLabel} (averaging ${proofAffinity.averageRating.toFixed(1)}).`,
    )
  }
  if (categoryAffinity) {
    tastePatterns.push(
      categoryAffinity.mode === 'rating-supported'
        ? `You seem to enjoy ${categoryAffinity.category} the most — averaging ${categoryAffinity.averageRating?.toFixed(1)} across ${categoryAffinity.pourCount} pours.`
        : `${categoryAffinity.category} is your most poured style so far.`,
    )
  }
  if (loyalty?.mostRepeated) {
    tastePatterns.push(
      `You've poured ${loyalty.mostRepeated.bottle.name} ${loyalty.mostRepeated.pourCount} times — more than any other bottle.`,
    )
  }
  if (buyAgain) {
    tastePatterns.push(`You'd buy roughly ${Math.round(buyAgain.rate * 100)}% of what you've poured again.`)
  }
  if (occasion) {
    tastePatterns.push(`Most of your logged pours have been for "${occasion.occasion}."`)
  }

  const evolutionText = !evolution
    ? undefined
    : evolution.kind === 'steady'
      ? 'Your ratings have stayed fairly consistent.'
      : evolution.kind === 'improved'
        ? `Your recent pours are averaging ${evolution.newAverage.toFixed(1)}, up from ${evolution.oldAverage.toFixed(1)} earlier on.`
        : `Your recent pours are averaging ${evolution.newAverage.toFixed(1)}, down from ${evolution.oldAverage.toFixed(1)} earlier on.`

  // Only shown once the shift is real (see PROOF_NOISE_THRESHOLD) — "steady"
  // isn't worth a second sentence next to evolutionText's own steady case.
  const proofEvolutionText =
    proofEvolution && proofEvolution.kind !== 'steady'
      ? `You used to average around ${proofEvolution.oldAverage.toFixed(0)} proof. Lately, you've been averaging closer to ${proofEvolution.newAverage.toFixed(0)} proof.`
      : undefined

  const summaryText = `You've logged ${pourCount} ${pourCount === 1 ? 'pour' : 'pours'} so far, averaging ${stats.averageScore.toFixed(1)} — ${tier.label}.`

  return {
    stats,
    hasBaseline,
    summaryText,
    radarValues,
    experiencedFlavors,
    preferredFlavors,
    preferredFlavorsNote,
    tastePatterns,
    evolutionText,
    proofEvolutionText,
  }
}
