import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { controlClassName } from '../../components/ui/Field'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { sendRecommendation } from '../../data/repositories/recommendations'
import { createNotification } from '../../data/repositories/notifications'
import styles from './RecommendBottleModal.module.css'

interface RecommendBottleModalProps {
  friendUid: string
  friendName: string
  onClose: () => void
}

// The friend-first counterpart to RecommendToFriendModal (bottle-first —
// pick a friend given a bottle). Reached from a friend's own card
// ("Recommend Bottle" in its contextual menu — see FriendCard.tsx), so the
// recipient is already fixed; this picks which of the viewer's own bottles
// to send instead. Wishlist items are excluded — recommending a bottle you
// don't actually have yet isn't the point of this feature.
export function RecommendBottleModal({ friendUid, friendName, onClose }: RecommendBottleModalProps) {
  const { user } = useAuth()
  const { userDoc, profile } = useUserData()
  const bottles = userDoc.bottles.filter((b) => b.status !== 'wishlist')
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const selectedBottle = bottles.find((b) => b.id === selectedBottleId)

  async function handleSend() {
    if (!user || !selectedBottle) return
    setSending(true)
    try {
      const recommendation = await sendRecommendation({
        senderId: user.uid,
        senderUsername: userDoc.username ?? '',
        senderDisplayName: profile?.displayName || user.displayName || undefined,
        senderPhotoURL: profile?.photoURL,
        recipientId: friendUid,
        bottleName: selectedBottle.name,
        bottleDistillery: selectedBottle.distillery,
        bottleImageUrl: selectedBottle.imageUrl,
        message: message.trim() || undefined,
      })
      await createNotification({
        recipientId: friendUid,
        type: 'bottle-recommended',
        actorId: user.uid,
        actorUsername: userDoc.username ?? '',
        actorDisplayName: profile?.displayName || user.displayName || undefined,
        actorPhotoURL: profile?.photoURL,
        refId: recommendation.id,
        refBottleName: selectedBottle.name,
      })
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <Modal title="Recommendation Sent" onClose={onClose}>
        <p className={styles.sentMessage}>{friendName} will find it in Friends → Shared.</p>
        <Button onClick={onClose}>Done</Button>
      </Modal>
    )
  }

  return (
    <Modal title={`Recommend a Bottle to ${friendName}`} onClose={onClose}>
      {bottles.length === 0 ? (
        <p className={styles.emptyMessage}>Add a bottle to your bar first to recommend one.</p>
      ) : (
        <>
          <div className={styles.bottleList}>
            {bottles.map((bottle) => (
              <button
                key={bottle.id}
                type="button"
                className={selectedBottleId === bottle.id ? `${styles.bottleOption} ${styles.bottleOptionActive}` : styles.bottleOption}
                onClick={() => setSelectedBottleId(bottle.id)}
                aria-pressed={selectedBottleId === bottle.id}
              >
                {bottle.name}
              </button>
            ))}
          </div>
          <textarea
            className={controlClassName}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional message…"
            rows={3}
            maxLength={280}
          />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={() => void handleSend()} disabled={!selectedBottleId || sending}>
              {sending ? 'Sending…' : 'Send Recommendation'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
