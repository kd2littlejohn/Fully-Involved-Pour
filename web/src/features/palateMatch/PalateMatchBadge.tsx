import { useState } from 'react'
import type { Bottle } from '../../data/types'
import { useUserData } from '../../hooks/useUserData'
import { buildPalateProfile } from '../yourPalate/palateProfile'
import { computePalateMatch } from './scoring'
import { explainPalateMatch } from '../../data/repositories/palateMatchExplanation'
import styles from './PalateMatchBadge.module.css'

const CONFIDENCE_LABEL = { high: 'High Confidence', medium: 'Medium Confidence', low: 'Low Confidence' } as const

interface PalateMatchBadgeProps {
  bottle: Bottle
}

// Deterministic score, computed fresh from the user's own current
// bottles/pours (see features/palateMatch/scoring.ts) — no AI involved in
// the number itself. The "Why It Fits" explanation is fetched on demand
// only, never automatically, and the AI there only ever narrates the
// already-computed reasons, never the score.
export function PalateMatchBadge({ bottle }: PalateMatchBadgeProps) {
  const { userDoc } = useUserData()
  const [explanation, setExplanation] = useState<string | undefined>(undefined)
  const [explaining, setExplaining] = useState(false)

  const profile = buildPalateProfile(userDoc.bottles, userDoc.pours)
  const match = computePalateMatch(bottle, userDoc.bottles, userDoc.pours, profile)

  if (match.status === 'still-learning') {
    return (
      <div className={styles.card}>
        <p className={styles.sectionLabel}>Palate Match</p>
        <p className={styles.stillLearning}>Still Learning Your Palate</p>
      </div>
    )
  }

  async function handleWhy() {
    if (explaining || explanation || match.score == null) return
    setExplaining(true)
    try {
      const result = await explainPalateMatch({ bottleName: bottle.name, score: match.score, confidence: match.confidence, reasons: match.reasons })
      if (result) setExplanation(result)
    } catch (err) {
      console.error('[PalateMatchBadge] explainPalateMatch failed', { bottleId: bottle.id, err })
    } finally {
      setExplaining(false)
    }
  }

  return (
    <div className={styles.card}>
      <p className={styles.sectionLabel}>Palate Match</p>
      <p className={styles.scoreLine}>
        {match.score}% Match <span className={styles.confidenceTag}>· {CONFIDENCE_LABEL[match.confidence]}</span>
      </p>

      {explanation ? (
        <p className={styles.explanation}>{explanation}</p>
      ) : match.reasons.length > 0 ? (
        <button type="button" className={styles.whyToggle} onClick={handleWhy} disabled={explaining}>
          {explaining ? 'Thinking…' : 'Why It Fits'}
          <span aria-hidden="true">{explaining ? '' : '→'}</span>
        </button>
      ) : null}
    </div>
  )
}
