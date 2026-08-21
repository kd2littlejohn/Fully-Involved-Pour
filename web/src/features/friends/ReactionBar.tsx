import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getReactions, removeReaction, setReaction } from '../../data/repositories/sharedMoments'
import { createNotification } from '../../data/repositories/notifications'
import { useUserData } from '../../hooks/useUserData'
import type { StoryReaction, StoryReactionType } from '../../data/types'
import styles from './ReactionBar.module.css'

// Whiskey-appropriate, not generic social-media reactions. Per-type counts
// shown next to each chip are informational, not framed as a headline
// "likes" total — see spec's "keep reactions lightweight."
const REACTIONS: { type: StoryReactionType; emoji: string; label: string }[] = [
  { type: 'cheers', emoji: '🥃', label: 'Cheers' },
  { type: 'great-pour', emoji: '🔥', label: 'Great Pour' },
  { type: 'need-to-try', emoji: '👀', label: 'Need to Try' },
  { type: 'good-notes', emoji: '📝', label: 'Good Notes' },
]

interface ReactionBarProps {
  sharedMomentId: string
  storyOwnerId: string
  bottleName?: string
}

export function ReactionBar({ sharedMomentId, storyOwnerId, bottleName }: ReactionBarProps) {
  const { user } = useAuth()
  const { userDoc, profile } = useUserData()
  const [reactions, setReactions] = useState<StoryReaction[]>([])

  useEffect(() => {
    let cancelled = false
    getReactions(sharedMomentId).then((r) => {
      if (!cancelled) setReactions(r)
    })
    return () => {
      cancelled = true
    }
  }, [sharedMomentId])

  const myReaction = reactions.find((r) => r.uid === user?.uid)

  async function toggle(type: StoryReactionType) {
    if (!user) return
    if (myReaction?.type === type) {
      await removeReaction(sharedMomentId, user.uid)
      setReactions((prev) => prev.filter((r) => r.uid !== user.uid))
      return
    }
    await setReaction(sharedMomentId, user.uid, type)
    setReactions((prev) => [
      ...prev.filter((r) => r.uid !== user.uid),
      { id: `${sharedMomentId}_${user.uid}`, sharedMomentId, uid: user.uid, type, createdAt: Date.now() },
    ])
    if (user.uid !== storyOwnerId) {
      await createNotification({
        recipientId: storyOwnerId,
        type: 'story-reaction',
        actorId: user.uid,
        actorUsername: userDoc.username ?? '',
        actorDisplayName: profile?.displayName || user.displayName || undefined,
        actorPhotoURL: profile?.photoURL,
        refId: sharedMomentId,
        refBottleName: bottleName,
      })
    }
  }

  return (
    <div className={styles.row}>
      {REACTIONS.map((r) => {
        const count = reactions.filter((reaction) => reaction.type === r.type).length
        const active = myReaction?.type === r.type
        return (
          <button
            key={r.type}
            type="button"
            className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            onClick={() => void toggle(r.type)}
            aria-pressed={active}
            aria-label={r.label}
          >
            <span aria-hidden="true">{r.emoji}</span>
            {count > 0 ? <span className={styles.count}>{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
