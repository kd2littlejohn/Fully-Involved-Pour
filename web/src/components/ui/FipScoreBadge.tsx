import { fipTier } from '../../features/fip/tiers'
import styles from './FipScoreBadge.module.css'

interface FipScoreBadgeProps {
  score: number
}

export function FipScoreBadge({ score }: FipScoreBadgeProps) {
  const tier = fipTier(score)
  return (
    <span className={styles.badge} style={{ color: tier.color }} title={tier.meaning}>
      <span className={styles.score}>{score.toFixed(1)}</span>
      <span className={styles.label}>{tier.label}</span>
    </span>
  )
}
