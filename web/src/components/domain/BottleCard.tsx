import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { summarizeInstanceStatuses } from '../../features/bottleInstances/selectors'
import { bottleJourneyStage } from '../../features/collection/journeyStage'
import { splitBottleTitle } from '../../features/collection/bottleTitle'
import { needsReplacement } from '../../features/collection/inventoryFilters'
import { useBottlePourFlow } from '../../features/startAPour/useBottlePourFlow'
import { useUserData } from '../../hooks/useUserData'
import { fillLevelPercent } from '../../features/bottleDetails/selectors'
import { Badge } from '../ui/Badge'
import { BottlePlaceholder } from '../ui/BottlePlaceholder'
import { FillLevelBar } from '../ui/FillLevelBar'
import { FipScoreBadge } from '../ui/FipScoreBadge'
import { RarityBadge } from '../ui/RarityBadge'
import { OverflowMenu, type OverflowMenuItem } from '../ui/OverflowMenu'
import { RecommendToFriendModal } from '../../features/friends/RecommendToFriendModal'
import { ChangeBottleStatusModal } from './ChangeBottleStatusModal'
import { FillLevelModal } from './FillLevelModal'
import styles from './BottleCard.module.css'
import { bottlePhotoUrl } from '../../features/photoUpload/bottlePhotoUrl'

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
  const [showFillLevelModal, setShowFillLevelModal] = useState(false)

  const currentBottleId = bottle.id
  const currentFavorite = bottle.favorite
  const currentNeedsReplacement = needsReplacement(bottle)
  // A wishlist bottle isn't owned yet — nothing to pour. Matches the same
  // pourable filter StartAPourButton's own bottle picker already applies.
  const canStartAPour = bottle.status !== 'wishlist'

  async function handleToggleFavorite() {
    await updateBottle(currentBottleId, { favorite: !currentFavorite })
  }

  async function handleToggleReplacement() {
    await updateBottle(currentBottleId, { wouldReplace: currentNeedsReplacement ? undefined : 'yes' })
  }

  // One expression is always one card, never one per physical bottle — a
  // multi-instance bottle just prints a count + status breakdown here
  // instead of the single status pill. Never a button: status can't be
  // changed from here once it's ambiguous which physical bottle that would
  // mean — see Bottle Details' "Your Bottles" section for that instead.
  const multiInstance = (bottle.instances?.length ?? 0) > 1
  // Fill level is only ever meaningful for a single, currently-open bottle —
  // ambiguous the moment there's more than one physical copy.
  const canUpdateFillLevel = bottle.status === 'open' && !multiInstance

  // Deliberately short — a handful of real actions in one "⋯" menu instead
  // of a row of buttons crowding every card.
  const menuItems: OverflowMenuItem[] = []
  if (canStartAPour) {
    menuItems.push({ label: 'Start a Pour', onClick: openPourFlow })
  }
  menuItems.push({ label: 'View Bottle', onClick: () => navigate(`/collection/${currentBottleId}`) })
  if (canUpdateFillLevel) {
    menuItems.push({ label: 'Update Fill Level', onClick: () => setShowFillLevelModal(true) })
  }
  menuItems.push(
    { label: currentFavorite ? 'Remove from Favorites' : 'Add to Favorites', onClick: () => void handleToggleFavorite() },
    {
      label: currentNeedsReplacement ? 'Remove from Replacement List' : 'Add to Replacement List',
      onClick: () => void handleToggleReplacement(),
    },
    { label: 'Recommend to Friend', onClick: () => setShowRecommendModal(true) },
    { label: 'Edit', onClick: () => navigate(`/bottles/${currentBottleId}/edit`) },
  )

  const totalQuantity = bottle.instances?.length ?? bottle.quantity ?? 1
  const instanceSummary = multiInstance ? (
    <div className={styles.instanceSummary}>
      <span className={styles.instanceCount}>{bottle.instances!.length} bottles</span>
      <span className={styles.instanceBreakdown}>{summarizeInstanceStatuses(bottle.instances!)}</span>
    </div>
  ) : totalQuantity > 1 ? (
    <span className={styles.quantityBadge}>× {totalQuantity}</span>
  ) : null

  const statusBadge = <Badge tone={STATUS_TONE[bottle.status]}>{STATUS_LABEL[bottle.status]}</Badge>
  // Opened bottles only: a sealed bottle is full by definition, and a
  // finished one has nothing left to meter.
  const fillPercent = multiInstance || bottle.status !== 'open' ? undefined : fillLevelPercent(bottle)
  const photoUrl = bottlePhotoUrl(bottle)
  const specLine = [typeof bottle.proof === 'number' ? `${bottle.proof} Proof` : undefined, bottle.type].filter(Boolean).join(' · ')

  // Photography first. Every card's photo area is the same 4:5 frame; the
  // real photo sits inside it whole (object-fit: contain, never cropped or
  // stretched), over a blurred, darkened copy of itself that fills the
  // rest of the frame edge to edge, so any photo shape reads as one
  // continuous image.
  const linkContent = (
    <>
      <div className={styles.media}>
        {photoUrl ? (
          <>
            <img className={styles.mediaBackdrop} src={photoUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" />
            <img className={styles.image} src={photoUrl} alt="" loading="lazy" decoding="async" />
          </>
        ) : (
          <BottlePlaceholder name={bottle.name} compact />
        )}
      </div>
      <div className={styles.titleBlock}>
        <div className={styles.name}>{title}</div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
        {specLine ? <div className={styles.specs}>{specLine}</div> : null}
      </div>
    </>
  )

  const fillMeter =
    typeof fillPercent === 'number' ? (
      <div className={styles.fill}>
        <FillLevelBar percent={fillPercent} />
        <span className={styles.fillLabel}>{fillPercent}% Full</span>
      </div>
    ) : null

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
      <RarityBadge bottle={bottle} />
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
          {fillMeter}
          {journey}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      {currentFavorite ? (
        <span className={styles.favoriteMark} title="Favorite" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </span>
      ) : null}
      <div className={styles.menuOverlay}>
        <OverflowMenu items={menuItems} label={`${bottle.name} actions`} />
      </div>
      <div className={styles.body}>
        <Link to={`/collection/${bottle.id}`} className={styles.bodyLink}>
          {linkContent}
        </Link>
        {instanceSummary}
        {footer}
        {fillMeter}
        {journey}
      </div>
      {modals}
      {showRecommendModal ? <RecommendToFriendModal bottle={bottle} onClose={() => setShowRecommendModal(false)} /> : null}
      {showStatusModal ? (
        <ChangeBottleStatusModal bottle={bottle} onUpdate={updateBottle} onClose={() => setShowStatusModal(false)} />
      ) : null}
      {showFillLevelModal ? (
        <FillLevelModal bottle={bottle} onUpdate={updateBottle} onClose={() => setShowFillLevelModal(false)} />
      ) : null}
    </div>
  )
}
