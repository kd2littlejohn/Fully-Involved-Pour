import { Section } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { RadarChart } from '../../components/ui/RadarChart'
import { FLAVOR_AXES } from '../flavorRadar/flavorCategories'
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
          message="Log a few Pour Stories and we'll start showing what you've experienced and what you tend to prefer."
        />
        {typeof averageProof === 'number' ? (
          <p className={styles.footnote}>Your bar averages {averageProof.toFixed(1)} proof.</p>
        ) : null}
      </Section>
    )
  }

  const {
    hasBaseline,
    summaryText,
    radarValues,
    experiencedFlavors,
    preferredFlavors,
    preferredFlavorsNote,
    tastePatterns,
    evolutionText,
    proofEvolutionText,
  } = insightText

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

      {experiencedFlavors.length > 0 ? (
        <div className={styles.gravitate}>
          <div className={styles.gravitateLabel}>Flavors you&rsquo;ve experienced most</div>
          <div className={styles.chips}>
            {experiencedFlavors.map((t) => (
              <Badge key={t.tag} tone="brass">
                {t.tag}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {/* A distinct measurement from the "experienced" chips above — how
          often a flavor comes up says nothing about whether it's actually
          liked. This only ever reflects pours that cleared TOP_RATED_THRESHOLD
          across TOP_RATED_MIN_BOTTLES+ different bottles (see
          getTopRatedFlavorTags), so one favorite bottle poured many times
          can't masquerade as a palate-wide preference. */}
      {preferredFlavors.length > 0 ? (
        <div className={styles.gravitate}>
          <div className={styles.gravitateLabel}>Flavors you tend to prefer</div>
          <div className={styles.chips}>
            {preferredFlavors.map((t) => (
              <Badge key={t.tag} tone="brass">
                {t.tag}
              </Badge>
            ))}
          </div>
        </div>
      ) : preferredFlavorsNote ? (
        <p className={styles.footnote}>{preferredFlavorsNote}</p>
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
