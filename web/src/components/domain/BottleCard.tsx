import { Link } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { Badge } from '../ui/Badge'
import styles from './BottleCard.module.css'

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

interface BottleCardProps {
  bottle: Bottle
}

export function BottleCard({ bottle }: BottleCardProps) {
  return (
    <Link to={`/collection/${bottle.id}`} className={styles.card}>
      <div className={styles.imageWrap}>
        {bottle.imageUrl ? (
          <img className={styles.image} src={bottle.imageUrl} alt="" />
        ) : (
          <span className={styles.placeholder}>No photo</span>
        )}
      </div>
      <div>
        <div className={styles.name}>{bottle.name}</div>
        {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
      </div>
      <div className={styles.footer}>
        <Badge tone={STATUS_TONE[bottle.status]}>{STATUS_LABEL[bottle.status]}</Badge>
        {typeof bottle.rating === 'number' ? <span>{bottle.rating.toFixed(1)}</span> : null}
      </div>
    </Link>
  )
}
