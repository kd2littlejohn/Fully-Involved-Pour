import { Link } from 'react-router-dom'
import type { Bottle, Pour } from '../../data/types'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { buildScoreEvolution } from '../bottleDetails/selectors'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import styles from './BottleJourneyCard.module.css'

interface BottleJourneyCardProps {
  bottle: Bottle
  pours: Pour[]
}

// Richer than the plain BottleCard grid this tab used to render — surfaces
// the bottle's actual score-evolution across real pours (Neck Pour -> ... ->
// Bottle Kill), not just a single static rating. Only shown once there's
// something to evolve; a bottle with 0-1 pours gets an honest nudge instead.
export function BottleJourneyCard({ bottle, pours }: BottleJourneyCardProps) {
  const journeyStage = bottleJourneyStage(bottle)
  const evolution = buildScoreEvolution(bottle, pours)

  return (
    <Link to={`/collection/${bottle.id}`} className={styles.card}>
      <div className={styles.header}>
        <div className={styles.imageWrap}>
          {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder name={bottle.name} />}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{bottle.name}</div>
          {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
          {journeyStage ? (
            <div className={styles.journey} style={{ color: journeyStage.color }}>
              <span className={styles.journeyDot} style={{ background: journeyStage.color }} />
              {journeyStage.label}
            </div>
          ) : null}
        </div>
      </div>

      {evolution ? (
        <div className={styles.evolution}>
          {evolution.points.map((point, index) => (
            <span className={styles.point} key={point.date + point.label}>
              {index > 0 ? <span className={styles.arrow}>{evolution.truncated ? '→ … →' : '→'}</span> : null}
              <span className={styles.pointScore}>{point.score.toFixed(1)}</span>
              <span className={styles.pointLabel}>{point.label}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>Log another pour to watch this bottle's score evolve.</p>
      )}
    </Link>
  )
}
