import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { useUserData } from '../../hooks/useUserData'
import { Badge } from '../ui/Badge'
import { BottlePlaceholder } from '../ui/BottlePlaceholder'
import { ChangeBottleStatusModal } from './ChangeBottleStatusModal'
import styles from './BottleListRow.module.css'

const STATUS_LABEL: Record<BottleStatus, string> = {
  open: 'Opened',
  sealed: 'Sealed',
  wishlist: 'Wishlist',
  finished: 'Finished',
  incoming: 'Incoming',
}

const STATUS_TONE: Record<BottleStatus, 'default' | 'amber' | 'brass'> = {
  open: 'amber',
  sealed: 'default',
  wishlist: 'brass',
  finished: 'default',
  incoming: 'brass',
}

interface BottleListRowProps {
  bottle: Bottle
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function BottleListRow({ bottle, selectable = false, selected = false, onToggleSelect }: BottleListRowProps) {
  const { updateBottle } = useUserData()
  const journeyStage = bottleJourneyStage(bottle)
  const [showStatusModal, setShowStatusModal] = useState(false)

  const mainContent = (
    <>
      {selectable ? (
        <span className={selected ? `${styles.checkbox} ${styles.checkboxChecked}` : styles.checkbox} aria-hidden="true">
          {selected ? '✓' : null}
        </span>
      ) : null}
      <div className={styles.imageWrap}>
        {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder compact name={bottle.name} />}
      </div>

      <div className={styles.info}>
        <div className={styles.name}>{bottle.name}</div>
        {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
      </div>
    </>
  )

  const statusBadge = <Badge tone={STATUS_TONE[bottle.status]}>{STATUS_LABEL[bottle.status]}</Badge>

  // Tapping the status pill opens the picker directly — kept as a plain
  // Badge (not a button) when selectable, since the whole row's click
  // already means "toggle selection" there.
  const meta = (
    <div className={styles.meta}>
      {journeyStage ? (
        <span className={styles.journey} style={{ color: journeyStage.color }}>
          {journeyStage.label}
        </span>
      ) : null}
      {selectable ? (
        statusBadge
      ) : (
        <button type="button" className={styles.statusButton} onClick={() => setShowStatusModal(true)}>
          {statusBadge}
        </button>
      )}
      {typeof bottle.rating === 'number' ? <span className={styles.score}>{bottle.rating.toFixed(1)}</span> : null}
    </div>
  )

  if (selectable) {
    return (
      <div
        className={`${styles.row} ${styles.rowLink}`}
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
        {mainContent}
        {meta}
      </div>
    )
  }

  return (
    <div className={styles.row}>
      <Link to={`/collection/${bottle.id}`} className={styles.rowLink}>
        {mainContent}
      </Link>
      {meta}
      {showStatusModal ? (
        <ChangeBottleStatusModal bottle={bottle} onUpdate={updateBottle} onClose={() => setShowStatusModal(false)} />
      ) : null}
    </div>
  )
}
