import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { controlClassName } from '../../components/ui/Field'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useFriends } from './useFriends'
import { sendRecommendation } from '../../data/repositories/recommendations'
import { createNotification } from '../../data/repositories/notifications'
import type { Bottle } from '../../data/types'
import styles from './RecommendToFriendModal.module.css'

interface RecommendToFriendModalProps {
  bottle: Pick<Bottle, 'name' | 'distillery' | 'imageUrl'>
  onClose: () => void
}

export function RecommendToFriendModal({ bottle, onClose }: RecommendToFriendModalProps) {
  const { user } = useAuth()
  const { userDoc, profile } = useUserData()
  const { friends, loading } = useFriends(user?.uid)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (!user || !selectedUid) return
    setSending(true)
    try {
      const recommendation = await sendRecommendation({
        senderId: user.uid,
        senderUsername: userDoc.username ?? '',
        senderDisplayName: profile?.displayName || user.displayName || undefined,
        senderPhotoURL: profile?.photoURL,
        recipientId: selectedUid,
        bottleName: bottle.name,
        bottleDistillery: bottle.distillery,
        bottleImageUrl: bottle.imageUrl,
        message: message.trim() || undefined,
      })
      await createNotification({
        recipientId: selectedUid,
        type: 'bottle-recommended',
        actorId: user.uid,
        actorUsername: userDoc.username ?? '',
        actorDisplayName: profile?.displayName || user.displayName || undefined,
        actorPhotoURL: profile?.photoURL,
        refId: recommendation.id,
        refBottleName: bottle.name,
      })
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <Modal title="Recommendation Sent" onClose={onClose}>
        <p className={styles.sentMessage}>They&rsquo;ll find it in Friends → Shared.</p>
        <Button onClick={onClose}>Done</Button>
      </Modal>
    )
  }

  return (
    <Modal title={`Recommend ${bottle.name}`} onClose={onClose}>
      {loading ? null : friends.length === 0 ? (
        <p className={styles.emptyMessage}>Add a friend first to send them a recommendation.</p>
      ) : (
        <>
          <div className={styles.friendList}>
            {friends.map((friend) => (
              <button
                key={friend.uid}
                type="button"
                className={selectedUid === friend.uid ? `${styles.friendOption} ${styles.friendOptionActive}` : styles.friendOption}
                onClick={() => setSelectedUid(friend.uid)}
                aria-pressed={selectedUid === friend.uid}
              >
                {friend.displayName || friend.username}
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
            <Button onClick={() => void handleSend()} disabled={!selectedUid || sending}>
              {sending ? 'Sending…' : 'Send Recommendation'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
