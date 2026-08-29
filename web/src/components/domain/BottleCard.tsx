import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { summarizeInstanceStatuses } from '../../features/bottleInstances/selectors'
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
    { label: currentFavorite ? 'Remove from Favorites' : 'Add to Favorites', onClick: () => void handleToggleFavorite() },
    { label: 'Recommend to Friend', onClick: () => setShowRecommendModal(true) },
    { label: 'Edit', onClick: () => navigate(`/bottles/${currentBottleId}/edit`) },
  )

  // One expression is always one card, never one per physical bottle — a
  // multi-instance bottle just prints a count + status breakdown here
  // instead of the single status pill. Never a button: status can't be
  // changed from here once it's ambiguous which physical bottle that would
  // mean — see Bottle Details' "Your Bottles" section for that instead.
  const multiInstance = (bottle.instances?.length ?? 0) > 1
  const instanceSummary = multiInstance ? (
    <div className={styles.instanceSummary}>
      <span className={styles.instanceCount}>{bottle.instances!.length} bottles</span>
      <span className={styles.instanceBreakdown}>{summarizeInstanceStatuses(bottle.instances!)}</span>
    </div>
  ) : null

  const statusBadge = <Badge tone={STATUS_TONE[bottle.status]}>{STATUS_LABEL[bottle.status]}</Badge>

  const linkContent = (
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
    </>
  )

  // Tapping the status pill itself opens the picker — no trip through the
  // "⋯" menu needed. Kept as a plain Badge (not a button) when selectable,
  // since the whole row's click already means "toggle selection" there.
  // Multi-instance bottles never get the status-change picker here (see
  // instanceSummary above for why) — just the plain summary text.
  const footer = (
    <div className={styles.footer}>
      {multiInstance ? null : selectable ? (
        statusBadge
      ) : (
        <button type="button" className={styles.statusButton} onClick={() => setShowStatusModal(true)}>
          {statusBadge}
        </button>
      )}
      {typeof bottle.rating === 'number' ? <FipScoreBadge score={bottle.rating} /> : null}
    </div>
  )

  const journey = journeyStage ? (
    <div className={styles.journey} style={{ color: journeyStage.color }}>
      <span className={styles.journeyDot} style={{ background: journeyStage.color }} />
      {journeyStage.label}
    </div>
  ) : null

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
        <div className={styles.body}>
          {linkContent}
          {instanceSummary}
          {footer}
          {journey}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.menuOverlay}>
        <OverflowMenu items={menuItems} label={`${bottle.name} actions`} />
      </div>
      <div className={styles.body}>
        <Link to={`/collection/${bottle.id}`} className={styles.bodyLink}>
          {linkContent}
        </Link>
        {instanceSummary}
        {footer}
        {journey}
      </div>
      {modals}
      {showRecommendModal ? <RecommendToFriendModal bottle={bottle} onClose={() => setShowRecommendModal(false)} /> : null}
      {showStatusModal ? (
        <ChangeBottleStatusModal bottle={bottle} onUpdate={updateBottle} onClose={() => setShowStatusModal(false)} />
      ) : null}
    </div>
  )
}
