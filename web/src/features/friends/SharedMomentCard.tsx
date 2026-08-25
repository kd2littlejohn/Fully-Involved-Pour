import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu'
import { useAuth } from '../../hooks/useAuth'
import { acceptSharedMoment } from '../../data/repositories/sharedMoments'
import { hideSharedMomentForUser } from '../../data/hiddenSharedMoments'
import { ReactionBar } from './ReactionBar'
import { CommentsList } from './CommentsList'
import type { SharedMoment } from '../../data/types'
import styles from './SharedMomentCard.module.css'

interface SharedMomentCardProps {
  moment: SharedMoment
  onChange?: () => void
  // Opens Friend Bottle Quick View for this pour's bottle — omitted where
  // there's nowhere to route it from (e.g. a context with no friend uid in
  // hand), in which case the bottle info just isn't tappable.
  onTapBottle?: () => void
}

// Tagging never transfers ownership — accepting just adds it to the
// participant's own shared-memories view; the story itself always still
// belongs to moment.ownerId.
export function SharedMomentCard({ moment, onChange, onTapBottle }: SharedMomentCardProps) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [accepting, setAccepting] = useState(false)

  const hasAccepted = user ? moment.acceptedParticipantIds.includes(user.uid) : true
  const isParticipant = user ? moment.participantIds.includes(user.uid) : false

  async function handleAccept() {
    if (!user) return
    setAccepting(true)
    try {
      await acceptSharedMoment(moment.id, user.uid)
      onChange?.()
    } finally {
      setAccepting(false)
    }
  }

  // Local-only "don't show me this again" — never deletes the owner's
  // original story, matching Blind Room's existing per-device hide pattern
  // (see data/hiddenSharedMoments.ts).
  function handleRemoveFromView() {
    if (!user) return
    hideSharedMomentForUser(user.uid, moment.id)
    onChange?.()
  }

  const menuItems: OverflowMenuItem[] = [{ label: 'Remove from my view', onClick: handleRemoveFromView }]

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <span className={styles.owner}>{moment.ownerDisplayName || moment.ownerUsername}</span>
          <span className={styles.eyebrow}>shared a Pour Story with you</span>
        </div>
        <OverflowMenu items={menuItems} label="Shared story actions" />
      </div>

      {onTapBottle ? (
        <button type="button" className={styles.body} onClick={onTapBottle}>
          {moment.snapshot.bottleImageUrl ? <img className={styles.image} src={moment.snapshot.bottleImageUrl} alt="" /> : null}
          <div className={styles.bottleInfo}>
            <div className={styles.bottleName}>{moment.snapshot.bottleName}</div>
            {moment.snapshot.distillery ? <div className={styles.distillery}>{moment.snapshot.distillery}</div> : null}
            {typeof moment.snapshot.rating === 'number' ? <div className={styles.rating}>Scored {moment.snapshot.rating.toFixed(1)}</div> : null}
          </div>
        </button>
      ) : (
        <div className={styles.body}>
          {moment.snapshot.bottleImageUrl ? <img className={styles.image} src={moment.snapshot.bottleImageUrl} alt="" /> : null}
          <div className={styles.bottleInfo}>
            <div className={styles.bottleName}>{moment.snapshot.bottleName}</div>
            {moment.snapshot.distillery ? <div className={styles.distillery}>{moment.snapshot.distillery}</div> : null}
            {typeof moment.snapshot.rating === 'number' ? <div className={styles.rating}>Scored {moment.snapshot.rating.toFixed(1)}</div> : null}
          </div>
        </div>
      )}

      {moment.snapshot.memory ? <p className={styles.memory}>{moment.snapshot.memory}</p> : null}

      {isParticipant && !hasAccepted ? (
        <Button onClick={() => void handleAccept()} disabled={accepting} className={styles.acceptButton}>
          {accepting ? 'Adding…' : 'Add to My Shared Memories'}
        </Button>
      ) : null}

      <ReactionBar sharedMomentId={moment.id} storyOwnerId={moment.ownerId} bottleName={moment.snapshot.bottleName} />

      <button type="button" className={styles.commentsToggle} onClick={() => setExpanded((v) => !v)}>
        {expanded ? 'Hide comments' : 'View comments'}
      </button>
      {expanded ? (
        <CommentsList sharedMomentId={moment.id} storyOwnerId={moment.ownerId} bottleName={moment.snapshot.bottleName} />
      ) : null}
    </div>
  )
}
