import { TapChip } from '../../components/ui/TapChip'
import { StatTile } from '../../components/ui/StatTile'
import type { Bottle, BottleBuyAgain, WouldReplace } from '../../data/types'
import type { BottlePatch } from '../../hooks/useUserData'
import { fipTier } from '../../features/fip/tiers'
import { parseLocalDate, type PourHistorySummary } from './selectors'
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

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface YourTakeCardProps {
  bottle: Bottle
  score: number | undefined
  scoreDate?: string
  pourHistory: PourHistorySummary
  onUpdate: (patch: BottlePatch) => void
  onViewJourney: () => void
}

// A settled, bottle-level verdict — deliberately separate from the per-pour
// buyAgain captured during a pour (that's an in-the-moment reaction; this is
// "overall, what do I think of this bottle"). Every value here is either
// real (the user tapped it, or came from an actual pour) or blank — nothing
// is defaulted or inferred. The favorite control lives in the hero now, not
// here — see BottleDetailsPage.
export function YourTakeCard({ bottle, score, scoreDate, pourHistory, onUpdate, onViewJourney }: YourTakeCardProps) {
  const tier = typeof score === 'number' ? fipTier(score) : undefined
  const starCount = typeof score === 'number' ? Math.max(0, Math.min(5, Math.round(score / 2))) : 0
  const hasPourHistory = pourHistory.pourCount > 0

  return (
    <div className={styles.card}>
      <div className={styles.heading}>Your Take</div>

      <div className={styles.scoreRow}>
        <div>
          <div className={styles.scoreValue}>{typeof score === 'number' ? score.toFixed(1) : '—'}</div>
          {tier ? <div className={styles.scoreTier} style={{ color: tier.color }}>{tier.label}</div> : null}
        </div>
        <div className={styles.scoreMeta}>
          {tier ? (
            <div className={styles.stars} aria-label={`${starCount} of 5 stars`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < starCount ? styles.starFilled : styles.starEmpty} aria-hidden="true">
                  ★
                </span>
              ))}
            </div>
          ) : null}
          {scoreDate ? <div className={styles.scoreDate}>Rated on {dateFormatter.format(parseLocalDate(scoreDate))}</div> : null}
        </div>
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

      {hasPourHistory ? (
        <div className={styles.statsRow}>
          {pourHistory.firstPouredDate ? (
            <StatTile value={dateFormatter.format(parseLocalDate(pourHistory.firstPouredDate))} label="First Poured" />
          ) : null}
          {pourHistory.lastPouredDate ? (
            <StatTile value={dateFormatter.format(parseLocalDate(pourHistory.lastPouredDate))} label="Last Poured" />
          ) : null}
          <StatTile value={pourHistory.pourCount} label={pourHistory.pourCount === 1 ? 'Pour Logged' : 'Pours Logged'} />
        </div>
      ) : null}

      <button type="button" className={styles.journeyButton} onClick={onViewJourney}>
        View My Journey <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}
