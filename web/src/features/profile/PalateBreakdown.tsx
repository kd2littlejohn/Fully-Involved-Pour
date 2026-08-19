import { topFlavorTagPercentages } from '../flavorRadar/flavorCategories'
import type { Bottle, Pour } from '../../data/types'
import styles from './PalateBreakdown.module.css'

const MIN_POURS_FOR_BREAKDOWN = 3

interface PalateBreakdownProps {
  bottles: Bottle[]
  pours: Pour[]
}

// Real percentages only (see topFlavorTagPercentages) — renders nothing
// below the same pour-count baseline the rest of Your Palate uses, since
// YourPalateSection already covers "not enough data yet" messaging for this
// whole area.
export function PalateBreakdown({ bottles, pours }: PalateBreakdownProps) {
  if (pours.length < MIN_POURS_FOR_BREAKDOWN) return null
  const percentages = topFlavorTagPercentages(bottles, pours, 5)
  if (percentages.length === 0) return null

  const shown = percentages.reduce((sum, p) => sum + p.percent, 0)
  const other = Math.max(0, 100 - shown)

  return (
    <div className={styles.card}>
      <div className={styles.label}>Flavor Breakdown</div>
      <div className={styles.list}>
        {percentages.map((p) => (
          <div className={styles.row} key={p.tag}>
            <span className={styles.tag}>{p.tag}</span>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${p.percent}%` }} />
            </div>
            <span className={styles.value}>{p.percent}%</span>
          </div>
        ))}
        {other > 0 ? (
          <div className={styles.row}>
            <span className={styles.tag}>Other</span>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${other}%` }} />
            </div>
            <span className={styles.value}>{other}%</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
