import type { Bottle, Pour } from '../../data/types'
import { dominantFlavorAxis, type FlavorAxis } from '../flavorRadar/flavorCategories'
import { getCategoryAffinity, getProofAffinity, getPalateStats } from '../yourPalate/selectors'
import { getAverageProof } from './selectors'
import { FIP_MAX } from '../fip/scoring'

const MIN_POURS_FOR_IDENTITY = 3
const RICH_COMPONENT_SHARE = 0.75

const AXIS_LABEL: Record<FlavorAxis, string> = {
  Sweet: 'Sweet',
  Spicy: 'Spice-Forward',
  Woody: 'Oak-Forward',
  Fruity: 'Fruit-Forward',
  Smoky: 'Smoky',
}

function proofDescriptor(bottles: Bottle[], pours: Pour[]): string | undefined {
  const affinity = getProofAffinity(bottles, pours)
  if (affinity) return affinity.bucketLabel
  const avg = getAverageProof(bottles)
  if (typeof avg !== 'number') return undefined
  if (avg >= 100) return 'Higher Proof'
  if (avg < 90) return 'Session Proof'
  return 'Standard Proof'
}

export interface WhiskeyIdentity {
  tags: string[]
  description: string
}

// Every tag here traces to a real selector already used elsewhere on
// Profile (dominant flavor axis, category/proof affinity, FIP component
// averages) — no invented adjectives, no numbers copied from a mockup.
// Gated on the same minimum-pours baseline YourPalateSection uses, so a
// near-empty account gets an honest "still forming" message instead of a
// confident-sounding identity it hasn't earned yet.
export function getWhiskeyIdentity(bottles: Bottle[], pours: Pour[]): WhiskeyIdentity | undefined {
  if (pours.length < MIN_POURS_FOR_IDENTITY) return undefined

  const tags: string[] = []
  const axis = dominantFlavorAxis(bottles, pours)
  if (axis) tags.push(AXIS_LABEL[axis.axis])

  const category = getCategoryAffinity(bottles, pours)
  if (category) tags.push(category.category)

  const proof = proofDescriptor(bottles, pours)
  if (proof) tags.push(proof)

  const stats = getPalateStats(pours)
  if (stats) {
    const palateShare = stats.averageComponents.palate / FIP_MAX.palate
    const complexityShare = stats.averageComponents.complexity / FIP_MAX.complexity
    if (palateShare >= RICH_COMPONENT_SHARE && palateShare >= complexityShare) tags.push('Rich')
    else if (complexityShare >= RICH_COMPONENT_SHARE) tags.push('Complex')
  }

  if (tags.length === 0) return undefined

  const descriptionParts: string[] = []
  if (category) {
    descriptionParts.push(
      category.mode === 'rating-supported' ? `You gravitate toward ${category.category}` : `${category.category} is what you reach for most`,
    )
  }
  if (axis) {
    descriptionParts.push(`with ${AXIS_LABEL[axis.axis].toLowerCase()} character showing up in ${axis.percent}% of what you've tagged`)
  }

  const description =
    descriptionParts.length > 0
      ? `${descriptionParts.join(', ')}.`
      : `Based on ${pours.length} logged ${pours.length === 1 ? 'pour' : 'pours'}, your palate is still taking shape.`

  return { tags: tags.slice(0, 4), description }
}
