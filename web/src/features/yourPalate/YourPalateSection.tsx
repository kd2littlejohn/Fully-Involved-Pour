import { Section } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { RadarChart } from '../../components/ui/RadarChart'
import { collectionFlavorRadarValues, topFlavorTags, FLAVOR_AXES } from '../flavorRadar/flavorCategories'
import { getAverageProof } from '../profile/selectors'
import { useAuth } from '../../hooks/useAuth'
import { buildPalateProfile } from './palateProfile'
import { usePalateInterpretation } from './usePalateInterpretation'
import { buildPalateInsightText } from './palateInsights'
import type { Bottle, Pour } from '../../data/types'
import styles from './YourPalateSection.module.css'

interface YourPalateSectionProps {
  bottles: Bottle[]
  pours: Pour[]
}

export function YourPalateSection({ bottles, pours }: YourPalateSectionProps) {
  const insightText = buildPalateInsightText(bottles, pours)
  const averageProof = getAverageProof(bottles)
  const { user } = useAuth()
  const palateProfile = buildPalateProfile(bottles, pours)
  const { state: interpretationState, interpretation } = usePalateInterpretation(user?.uid, palateProfile)

  if (!insightText) {
    return (
      <Section title="Your Palate">
        <EmptyState
          title="Your palate starts here."
          message="Log a few Pour Stories and we'll start showing you what you gravitate toward."
        />
        {typeof averageProof === 'number' ? (
          <p className={styles.footnote}>Your bar averages {averageProof.toFixed(1)} proof.</p>
        ) : null}
      </Section>
    )
  }

  const { hasBaseline, summaryText, tastePatterns, evolutionText, proofEvolutionText } = insightText
  const radarValues = hasBaseline ? collectionFlavorRadarValues(bottles, pours) : undefined
  const topTags = hasBaseline ? topFlavorTags(bottles, pours, 6) : []

  return (
    <Section title="Your Palate">
      <p className={styles.summary}>{summaryText}</p>
      {typeof averageProof === 'number' ? <p className={styles.footnote}>{`Your bar averages ${averageProof.toFixed(1)} proof.`}</p> : null}
      {!hasBaseline ? <p className={styles.footnote}>A few more pours and we&rsquo;ll start showing patterns.</p> : null}

      {radarValues ? (
        <div className={styles.radarWrap}>
          <RadarChart axes={[...FLAVOR_AXES]} series={[{ label: 'Your Palate', color: 'var(--fip-amber)', values: radarValues }]} size={260} />
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

      {interpretationState === 'ready' && interpretation ? (
        <div className={styles.learning}>
          <div className={styles.patternsLabel}>What FIP Is Learning</div>
          <p className={styles.learningText}>{interpretation}</p>
        </div>
      ) : null}
    </Section>
  )
}
