import type { Bottle, Pour } from '../../data/types'
import { StatTile } from '../../components/ui/StatTile'
import { buildRatingProgression, getFinishedDate, getPoursForBottle } from './selectors'
import styles from './BottleStorySummary.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function BottleStorySummary({ bottle, pours }: { bottle: Bottle; pours: Pour[] }) {
  const bottlePours = getPoursForBottle(pours, bottle.id)
  const pourCount = bottlePours.length
  if (pourCount === 0) return null

  const chronological = [...bottlePours].sort((a, b) => a.date.localeCompare(b.date))
  const firstDate = chronological[0]!.date
  const lastDate = chronological[chronological.length - 1]!.date
  const finished = getFinishedDate(bottle, pours)
  const progression = buildRatingProgression(bottlePours)
  const averageAcrossAllPours = bottlePours.reduce((sum, p) => sum + p.rating, 0) / pourCount

  return (
    <div className={styles.summary}>
      <div className={styles.heading}>Your Story</div>

      <div className={styles.statsRow}>
        <StatTile value={pourCount} label={pourCount === 1 ? 'Pour' : 'Pours'} />
        <StatTile value={averageAcrossAllPours.toFixed(1)} label="Average" />
      </div>

      <div className={styles.dates}>
        {finished ? (
          <>
            {bottle.openedDate ? <span>Opened {dateFormatter.format(new Date(bottle.openedDate))}</span> : null}
            <span>
              Finished {dateFormatter.format(new Date(finished.date))}
              {finished.inferred ? ' (estimated)' : ''}
            </span>
          </>
        ) : (
          <>
            <span>First Pour {dateFormatter.format(new Date(firstDate))}</span>
            {pourCount > 1 ? <span>Last Pour {dateFormatter.format(new Date(lastDate))}</span> : null}
          </>
        )}
      </div>

      {progression ? (
        <div className={styles.progression}>
          <span className={styles.progressionLabel}>Your Rating</span>
          <span className={styles.progressionValue}>{progression}</span>
        </div>
      ) : null}
    </div>
  )
}
