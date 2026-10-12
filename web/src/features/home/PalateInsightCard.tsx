import { Link } from 'react-router-dom'
import type { PalateInsight } from './selectors'
import { Button } from '../../components/ui/Button'
import styles from './PalateInsightCard.module.css'

interface PalateInsightCardProps {
  insight: PalateInsight
}

export function PalateInsightCard({ insight }: PalateInsightCardProps) {
  if (insight.kind === 'summary') {
    // Rating-based insights when there's no clear flavor trend yet — the
    // same validated lines Profile → Your Palate shows.
    return (
      <div className={styles.card}>
        <div className={styles.eyebrow}>Your Palate Lately</div>
        <p className={styles.headline}>{insight.headline}</p>
        {insight.details.length > 0 ? (
          <ul className={styles.details}>
            {insight.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <p className={styles.note}>{insight.flavorNote}</p>
        <Link to="/journal">
          <Button variant="secondary">See My Journey</Button>
        </Link>
      </div>
    )
  }

  const { headline, primaryLabel, primaryPercent, secondaryLabel, secondaryPercent } = insight

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Your Palate Lately</div>
      <p className={styles.headline}>{headline}</p>

      <div className={styles.bars}>
        <div className={styles.barRow}>
          <div className={styles.barLabel}>
            <span>{primaryLabel}</span>
            <span>{primaryPercent}%</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fillPrimary} style={{ width: `${primaryPercent}%` }} />
          </div>
        </div>
        <div className={styles.barRow}>
          <div className={styles.barLabel}>
            <span>{secondaryLabel}</span>
            <span>{secondaryPercent}%</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fillSecondary} style={{ width: `${secondaryPercent}%` }} />
          </div>
        </div>
      </div>

      <Link to="/journal">
        <Button variant="secondary">See My Journey</Button>
      </Link>
    </div>
  )
}

// Honest empty state — only when there are no pours at all. Matches the
// redesign brief's "if not enough data" copy verbatim.
export function PalateInsightEmptyCard() {
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Your Palate Lately</div>
      <p className={styles.headline}>Keep logging pours and your palate trends will appear here.</p>
      <Link to="/journal">
        <Button variant="secondary">See My Journey</Button>
      </Link>
    </div>
  )
}
