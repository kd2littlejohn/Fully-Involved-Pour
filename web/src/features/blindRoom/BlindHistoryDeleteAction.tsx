import { useState } from 'react'
import { OverflowMenu } from '../../components/ui/OverflowMenu'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { deleteBlindRoom } from '../../data/repositories/blindRoom'
import { hideBlindRoomForUser } from '../../data/hiddenBlindRooms'
import type { BlindRoom } from '../../data/types'
import styles from './BlindHistoryDeleteAction.module.css'

interface BlindHistoryDeleteActionProps {
  room: BlindRoom
  uid: string
  isHost: boolean
  onDeleted: (room: BlindRoom) => void
}

// Drop-in "Delete Blind" action for any card/row showing a Blind History
// entry (BlindRoomLandingPage's Recent Blinds, the Journal page's Blind
// Stories, and Bottle Details' per-bottle Blind History all render the same
// BlindRoom shape, just filtered differently) — one place owns the
// confirmation copy, the host/participant branch, and the
// idempotent-while-in-flight guard, so all three surfaces behave identically.
// Host deletion is permanent for every participant (see deleteBlindRoom);
// a non-host participant can only drop the room from their own device-local
// history (see hiddenBlindRooms.ts) — firestore.rules only grants delete on
// the underlying documents to the room's hostUid, so that split isn't a UI
// choice, it's the only thing the data model (and security rules) allow.
export function BlindHistoryDeleteAction({ room, uid, isHost, onDeleted }: BlindHistoryDeleteActionProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(false)

  async function handleConfirm() {
    if (deleting) return
    setDeleting(true)
    setError(false)
    try {
      if (isHost) {
        await deleteBlindRoom(room.id)
      } else {
        hideBlindRoomForUser(uid, room.id)
      }
      setConfirming(false)
      onDeleted(room)
    } catch (err) {
      console.error('BlindHistoryDeleteAction delete failed', err)
      setError(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <OverflowMenu
        items={[{ label: 'Delete Blind', tone: 'danger', onClick: () => setConfirming(true) }]}
        label={`${room.name} actions`}
      />
      {confirming ? (
        <Modal title="Delete this blind?" onClose={() => (deleting ? undefined : setConfirming(false))}>
          <p className={styles.body}>This will remove the saved blind results and related history. This cannot be undone.</p>
          {error ? <p className={styles.error}>We couldn&rsquo;t delete this blind. Try again.</p> : null}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => void handleConfirm()} disabled={deleting}>
              {deleting ? 'Deleting…' : isHost ? 'Delete Blind for Everyone' : 'Remove From My History'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
