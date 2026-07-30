import { Link } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { Badge } from '../ui/Badge'
import { BottlePlaceholder } from '../ui/BottlePlaceholder'
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
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function BottleCard({ bottle, selectable = false, selected = false, onToggleSelect }: BottleCardProps) {
  const journeyStage = bottleJourneyStage(bottle)

  const content = (
    <>
      {selectable ? (
        <span className={selected ? `${styles.checkbox} ${styles.checkboxChecked}` : styles.checkbox} aria-hidden="true">
          {selected ? '✓' : null}
        </span>
      ) : null}
      <div className={styles.imageWrap}>
        {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder />}
      </div>
      <div>
        <div className={styles.name}>{bottle.name}</div>
        {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
      </div>
      <div className={styles.footer}>
        <Badge tone={STATUS_TONE[bottle.status]}>{STATUS_LABEL[bottle.status]}</Badge>
        {typeof bottle.rating === 'number' ? <span>{bottle.rating.toFixed(1)}</span> : null}
      </div>
      {journeyStage ? (
        <div className={styles.journey} style={{ color: journeyStage.color }}>
          <span className={styles.journeyDot} style={{ background: journeyStage.color }} />
          {journeyStage.label}
        </div>
      ) : null}
    </>
  )

  if (selectable) {
    return (
      <div
        className={selected ? `${styles.card} ${styles.cardSelected}` : styles.card}
        role="checkbox"
        aria-checked={selected}
        aria-label={bottle.name}
        tabIndex={0}
        onClick={onToggleSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleSelect?.()
          }
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <Link to={`/collection/${bottle.id}`} className={styles.card}>
      {content}
    </Link>
  )
}
