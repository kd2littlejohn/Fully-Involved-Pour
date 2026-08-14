import { TapChip } from '../../components/ui/TapChip'
import type { Bottle, BottleBuyAgain, WouldReplace } from '../../data/types'
import type { BottlePatch } from '../../hooks/useUserData'
import styles from './YourTakeCard.module.css'

const BUY_AGAIN_OPTIONS: { value: BottleBuyAgain; label: string }[] = [
  { value: 'absolutely', label: 'Absolutely' },
  { value: 'at-msrp', label: 'At MSRP' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'probably-not', label: 'Probably Not' },
  { value: 'no', label: 'No' },
]

const REPLACE_OPTIONS: { value: WouldReplace; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
]

interface YourTakeCardProps {
  bottle: Bottle
  score: number | undefined
  onUpdate: (patch: BottlePatch) => void
}

// A settled, bottle-level verdict — deliberately separate from the per-pour
// buyAgain captured during a pour (that's an in-the-moment reaction; this is
// "overall, what do I think of this bottle"). Every value here is either
// real (the user tapped it) or blank — nothing is defaulted or inferred.
export function YourTakeCard({ bottle, score, onUpdate }: YourTakeCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.heading}>Your Take</div>

      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>FIP Score</span>
        <span className={styles.scoreValue}>{typeof score === 'number' ? score.toFixed(1) : '—'}</span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Would you buy again?</div>
        <div className={styles.chipRow}>
          {BUY_AGAIN_OPTIONS.map((option) => (
            <TapChip
              key={option.value}
              label={option.label}
              active={bottle.buyAgain === option.value}
              onToggle={() => onUpdate({ buyAgain: option.value })}
            />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Would you replace it?</div>
        <div className={styles.chipRow}>
          {REPLACE_OPTIONS.map((option) => (
            <TapChip
              key={option.value}
              label={option.label}
              active={bottle.wouldReplace === option.value}
              onToggle={() => onUpdate({ wouldReplace: option.value })}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className={bottle.favorite ? `${styles.favoriteButton} ${styles.favoriteActive}` : styles.favoriteButton}
        onClick={() => onUpdate({ favorite: !bottle.favorite })}
        aria-pressed={Boolean(bottle.favorite)}
      >
        {bottle.favorite ? '★ Favorited' : '☆ Add to Favorites'}
      </button>
    </div>
  )
}
