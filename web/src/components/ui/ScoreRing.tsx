import { fipTier } from '../../features/fip/tiers'
import styles from './ScoreRing.module.css'

interface ScoreRingProps {
  score: number
}

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ScoreRing({ score }: ScoreRingProps) {
  const tier = fipTier(score)
  const fraction = Math.max(0, Math.min(1, score / 10))
  const offset = CIRCUMFERENCE * (1 - fraction)

  return (
    <div className={styles.wrap}>
      <svg className={styles.svg} viewBox="0 0 100 100">
        <circle className={styles.track} cx="50" cy="50" r={RADIUS} />
        <circle
          className={styles.value}
          cx="50"
          cy="50"
          r={RADIUS}
          stroke={tier.color}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={styles.label}>
        <span className={styles.score}>{score.toFixed(1)}</span>
        <span className={styles.max}>/ 10</span>
      </div>
    </div>
  )
}
