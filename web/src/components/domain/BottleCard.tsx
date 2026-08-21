import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { splitBottleTitle } from '../../features/collection/bottleTitle'
import { useBottlePourFlow } from '../../features/startAPour/useBottlePourFlow'
import { useUserData } from '../../hooks/useUserData'
import { Badge } from '../ui/Badge'
import { BottlePlaceholder } from '../ui/BottlePlaceholder'
import { FipScoreBadge } from '../ui/FipScoreBadge'
import { OverflowMenu, type OverflowMenuItem } from '../ui/OverflowMenu'
import { RecommendToFriendModal } from '../../features/friends/RecommendToFriendModal'
import { ChangeBottleStatusModal } from './ChangeBottleStatusModal'
import styles from './BottleCard.module.css'

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

interface BottleCardProps {
  bottle: Bottle
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function BottleCard({ bottle, selectable = false, selected = false, onToggleSelect }: BottleCardProps) {
  const navigate = useNavigate()
  const { updateBottle } = useUserData()
  const journeyStage = bottleJourneyStage(bottle)
  const { title, subtitle } = splitBottleTitle(bottle.name)
  const { open: openPourFlow, modals } = useBottlePourFlow(bottle.id)
  const [showRecommendModal, setShowRecommendModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)

  const currentBottleId = bottle.id
  const currentFavorite = bottle.favorite
  // A wishlist bottle isn't owned yet — nothing to pour. Matches the same
  // pourable filter StartAPourButton's own bottle picker already applies.
  const canStartAPour = bottle.status !== 'wishlist'

  async function handleToggleFavorite() {
    await updateBottle(currentBottleId, { favorite: !currentFavorite })
  }

  // Deliberately short — a handful of real actions in one "⋯" menu instead
  // of a row of buttons crowding every card.
  const menuItems: OverflowMenuItem[] = []
  if (canStartAPour) {
    menuItems.push({ label: 'Start a Pour', onClick: openPourFlow })
  }
  menuItems.push(
    { label: 'View Bottle', onClick: () => navigate(`/collection/${currentBottleId}`) },
    { label: 'Change Status', onClick: () => setShowStatusModal(true) },
    { label: currentFavorite ? 'Remove from Favorites' : 'Add to Favorites', onClick: () => void handleToggleFavorite() },
    { label: 'Recommend to Friend', onClick: () => setShowRecommendModal(true) },
    { label: 'Edit', onClick: () => navigate(`/bottles/${currentBottleId}/edit`) },
  )

  const content = (
    <>
      <div className={styles.imageWrap}>
        {bottle.imageUrl ? (
          <img className={styles.image} src={bottle.imageUrl} alt="" />
        ) : (
          <BottlePlaceholder name={bottle.name} compact />
        )}
      </div>
      <div className={styles.titleBlock}>
        <div className={styles.name}>{title}</div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
        {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
      </div>
      <div className={styles.footer}>
        <Badge tone={STATUS_TONE[bottle.status]}>{STATUS_LABEL[bottle.status]}</Badge>
        {typeof bottle.rating === 'number' ? <FipScoreBadge score={bottle.rating} /> : null}
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
        <span className={selected ? `${styles.checkbox} ${styles.checkboxChecked}` : styles.checkbox} aria-hidden="true">
          {selected ? '✓' : null}
        </span>
        <div className={styles.body}>{content}</div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.menuOverlay}>
        <OverflowMenu items={menuItems} label={`${bottle.name} actions`} />
      </div>
      <Link to={`/collection/${bottle.id}`} className={`${styles.body} ${styles.bodyLink}`}>
        {content}
      </Link>
      {modals}
      {showRecommendModal ? <RecommendToFriendModal bottle={bottle} onClose={() => setShowRecommendModal(false)} /> : null}
      {showStatusModal ? (
        <ChangeBottleStatusModal bottle={bottle} onUpdate={updateBottle} onClose={() => setShowStatusModal(false)} />
      ) : null}
    </div>
  )
}
