import type { Bottle } from '../../data/types'
import { confirmedRarityOf } from '../../features/rarity/rarityFields'
import { RARITY_LABEL, UNCLASSIFIED_LABEL } from '../../features/rarity/rarityLevels'
import styles from './RarityBadge.module.css'

interface RarityBadgeProps {
  bottle: Pick<Bottle, 'rarity' | 'raritySource'>
}

// Always renders — a muted, outlined "Unclassified" badge covers no
// rarity, a pending-but-unaccepted suggestion, and a declined suggestion
// identically (none of those are confirmed), never hidden. Owner-facing
// only: BottleCard/BottleListRow (the only current callers) are never used
// in any friend-facing view (FriendProfilePage renders its own card off
// SharedBottleSummary, which has no rarity field at all).
export function RarityBadge({ bottle }: RarityBadgeProps) {
  const rarity = confirmedRarityOf(bottle)
  if (!rarity) {
    return (
      <span className={`${styles.badge} ${styles.unclassified}`}>{UNCLASSIFIED_LABEL}</span>
    )
  }
  return <span className={`${styles.badge} ${styles[rarity]}`}>{RARITY_LABEL[rarity]}</span>
}
