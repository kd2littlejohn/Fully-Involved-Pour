import { Link } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { Badge } from '../ui/Badge'
import { BottlePlaceholder } from '../ui/BottlePlaceholder'
import styles from './BottleListRow.module.css'

const STATUS_LABEL: Record<BottleStatus, string> = {
  open: 'Opened',
  sealed: 'Sealed',
  wishlist: 'Wishlist',
  finished: 'Finished',
}

const STATUS_TONE: Record<BottleStatus, 'default' | 'amber' | 'brass'> = {
  open: 'amber',
  sealed: 'default',
  wishlist: 'brass',
  finished: 'default',
}

export function BottleListRow({ bottle }: { bottle: Bottle }) {
  const journeyStage = bottleJourneyStage(bottle)

  return (
    <Link to={`/collection/${bottle.id}`} className={styles.row}>
      <div className={styles.imageWrap}>
        {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder compact />}
      </div>

      <div className={styles.info}>
        <div className={styles.name}>{bottle.name}</div>
        {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
      </div>

      <div className={styles.meta}>
        {journeyStage ? (
          <span className={styles.journey} style={{ color: journeyStage.color }}>
            {journeyStage.label}
          </span>
        ) : null}
        <Badge tone={STATUS_TONE[bottle.status]}>{STATUS_LABEL[bottle.status]}</Badge>
        {typeof bottle.rating === 'number' ? <span className={styles.score}>{bottle.rating.toFixed(1)}</span> : null}
      </div>
    </Link>
  )
}
