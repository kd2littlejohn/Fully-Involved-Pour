import { fipTier } from '../fip/tiers'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatTile } from '../../components/ui/StatTile'
import type { BlindProfileStats } from './useBlindProfileStats'
import styles from './BlindProfileCard.module.css'

interface BlindProfileCardProps {
  stats?: BlindProfileStats
}

export function BlindProfileCard({ stats }: BlindProfileCardProps) {
  if (!stats || stats.completedCount === 0) {
    return (
      <EmptyState
        title="Your Blind Profile starts here."
        message="Complete a Blind Room tasting to start discovering what you actually prefer, unbiased by the label."
      />
    )
  }

  const tier = typeof stats.averageScore === 'number' ? fipTier(stats.averageScore) : undefined

  return (
    <div className={styles.card}>
      <div className={styles.statsRow}>
        <StatTile value={stats.completedCount} label="Blind Tastings" />
        {typeof stats.averageScore === 'number' ? <StatTile value={stats.averageScore.toFixed(1)} label="Avg. Score" /> : null}
      </div>
      {stats.mostFrequentWinner ? (
        <p className={styles.line}>
          <strong className={styles.strong}>{stats.mostFrequentWinner.bottleName}</strong> has come out on top{' '}
          {stats.mostFrequentWinner.wins} times.
        </p>
      ) : null}
      {tier ? <p className={styles.tierLine}>Your blind pours tend to land in {tier.label} territory.</p> : null}
    </div>
  )
}
