import { Section } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { RadarChart } from '../../components/ui/RadarChart'
import { fipTier } from '../fip/tiers'
import { collectionFlavorRadarValues, topFlavorTags, FLAVOR_AXES } from '../flavorRadar/flavorCategories'
import { getAverageProof } from '../profile/selectors'
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
} from './selectors'
import type { Bottle, Pour } from '../../data/types'
import styles from './YourPalateSection.module.css'

const BASELINE_MIN_POURS = 3

interface YourPalateSectionProps {
  bottles: Bottle[]
  pours: Pour[]
}

export function YourPalateSection({ bottles, pours }: YourPalateSectionProps) {
  const stats = getPalateStats(pours)
  const averageProof = getAverageProof(bottles)

  if (!stats) {
    return (
      <Section title="Your Palate">
        <EmptyState
          title="Your palate starts here."
          message="Log a few Pour Stories and we'll start showing you what you gravitate toward."
        />
        {typeof averageProof === 'number' ? (
          <p className={styles.footnote}>Your collection averages {averageProof.toFixed(1)} proof.</p>
        ) : null}
      </Section>
    )
  }

  const pourCount = stats.pourCount
  const hasBaseline = pourCount >= BASELINE_MIN_POURS
  const tier = fipTier(stats.averageScore)

  const radarValues = hasBaseline ? collectionFlavorRadarValues(bottles, pours) : undefined
  const topTags = hasBaseline ? topFlavorTags(bottles, pours, 6) : []
  const categoryAffinity = hasBaseline ? getCategoryAffinity(bottles, pours) : undefined
  const proofAffinity = hasBaseline ? getProofAffinity(bottles, pours) : undefined
  const loyalty = hasBaseline ? getLoyaltySignal(bottles, pours) : undefined
  const buyAgain = hasBaseline ? getBuyAgainRate(pours) : undefined
  const occasion = hasBaseline ? getTopOccasion(pours) : undefined
  const evolution = getPalateEvolution(pours)
  const proofEvolution = getProofEvolution(bottles, pours)
  const topRatedFlavors = hasBaseline ? getTopRatedFlavorTags(bottles, pours) : []

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
  if (topRatedFlavors.length > 0) {
    const tagList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(topRatedFlavors.map((t) => t.tag))
    tastePatterns.push(`Your highest-rated pours tend to have ${tagList} notes.`)
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

  return (
    <Section title="Your Palate">
      <p className={styles.summary}>{summaryText}</p>
      {typeof averageProof === 'number' ? <p className={styles.footnote}>{`Your collection averages ${averageProof.toFixed(1)} proof.`}</p> : null}
      {!hasBaseline ? <p className={styles.footnote}>A few more pours and we&rsquo;ll start showing patterns.</p> : null}

      {radarValues ? (
        <div className={styles.radarWrap}>
          <RadarChart axes={[...FLAVOR_AXES]} series={[{ label: 'Your Palate', color: 'var(--fip-amber)', values: radarValues }]} size={200} />
        </div>
      ) : null}

      {topTags.length > 0 ? (
        <div className={styles.gravitate}>
          <div className={styles.gravitateLabel}>You seem to gravitate toward</div>
          <div className={styles.chips}>
            {topTags.map((t) => (
              <Badge key={t.tag} tone="brass">
                {t.tag}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {tastePatterns.length > 0 ? (
        <div className={styles.patterns}>
          <div className={styles.patternsLabel}>Taste Patterns</div>
          <ul className={styles.patternsList}>
            {tastePatterns.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {evolutionText || proofEvolutionText ? (
        <div className={styles.evolution}>
          <div className={styles.patternsLabel}>Palate Evolution</div>
          {evolutionText ? <p className={styles.evolutionText}>{evolutionText}</p> : null}
          {proofEvolutionText ? <p className={styles.evolutionText}>{proofEvolutionText}</p> : null}
        </div>
      ) : null}
    </Section>
  )
}
