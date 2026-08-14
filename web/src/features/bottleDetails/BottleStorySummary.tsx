import type { Bottle, Pour } from '../../data/types'
import { StatTile } from '../../components/ui/StatTile'
import { Badge } from '../../components/ui/Badge'
import { topFlavorTags } from '../flavorRadar/flavorCategories'
import { buildRatingProgression, getFinishedDate, getPoursForBottle } from './selectors'
import styles from './BottleStorySummary.module.css'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

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

  // First-vs-latest headline delta — distinct from `progression` (the full
  // sequence): this is the quick "has my take on this bottle changed?"
  // answer. Needs at least two real pours; never inferred from one.
  const firstScore = chronological[0]!.rating
  const latestScore = chronological[chronological.length - 1]!.rating
  const scoreChange = pourCount >= 2 ? round1(latestScore - firstScore) : undefined

  // Scoped to just this bottle (and only its own pours) — topFlavorTags also
  // pulls a bottle's static `flavors` field, so passing the whole collection
  // here would let unrelated bottles' tags leak into "most common notes."
  const commonNotes = topFlavorTags([bottle], bottlePours, 4)

  return (
    <div className={styles.summary}>
      <div className={styles.heading}>Bottle Journey</div>

      <div className={styles.statsRow}>
        <StatTile value={pourCount} label={pourCount === 1 ? 'Pour' : 'Pours'} />
        <StatTile value={averageAcrossAllPours.toFixed(1)} label="Average" />
      </div>

      {pourCount >= 2 && scoreChange != null ? (
        <div className={styles.statsRowTriple}>
          <StatTile value={firstScore.toFixed(1)} label="First Score" />
          <StatTile value={latestScore.toFixed(1)} label="Latest Score" />
          <StatTile value={`${scoreChange > 0 ? '+' : ''}${scoreChange.toFixed(1)}`} label="Change" />
        </div>
      ) : null}

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

      {commonNotes.length > 0 ? (
        <div className={styles.notes}>
          <span className={styles.progressionLabel}>Most Common Notes</span>
          <div className={styles.notesChips}>
            {commonNotes.map((tag) => (
              <Badge key={tag.tag} tone="brass">
                {tag.tag}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
