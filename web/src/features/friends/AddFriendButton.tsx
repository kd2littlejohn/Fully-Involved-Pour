import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useFriendStatus } from './useFriendStatus'
import styles from './AddFriendButton.module.css'

function FriendsMenuButton({ onRemove, onBlock }: { onRemove: () => void; onBlock: () => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div className={styles.friendsMenuRoot} ref={rootRef}>
      <Button variant="secondary" onClick={() => setOpen((v) => !v)} className={styles.button} aria-expanded={open}>
        Friends ▾
      </Button>
      {open ? (
        <div className={styles.menuPanel} role="menu">
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onRemove()
            }}
          >
            Remove Friend
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onBlock()
            }}
          >
            Block
          </button>
        </div>
      ) : null}
    </div>
  )
}

interface AddFriendButtonProps {
  targetUid: string
}

// Renders the right action for whichever of the five relationship states
// (none/outgoing_pending/incoming_pending/friends/blocked) applies —
// never "follow"/"following" language, since a friendship is mutual.
export function AddFriendButton({ targetUid }: AddFriendButtonProps) {
  const { status, loading, acting, send, cancel, remove, block, unblock } = useFriendStatus(targetUid)

  if (loading) return null

  if (status === 'none') {
    return (
      <Button onClick={() => void send()} disabled={acting} className={styles.button}>
        {acting ? 'Sending…' : 'Add Friend'}
      </Button>
    )
  }

  if (status === 'outgoing_pending') {
    return (
      <Button variant="secondary" onClick={() => void cancel()} disabled={acting} className={styles.button}>
        {acting ? 'Cancelling…' : 'Pending — Cancel'}
      </Button>
    )
  }

  if (status === 'incoming_pending') {
    return (
      <Link to="/friends?tab=requests" className={styles.pendingLink}>
        <Button variant="secondary" className={styles.button}>
          Wants to be friends
        </Button>
      </Link>
    )
  }

  if (status === 'friends') {
    return <FriendsMenuButton onRemove={() => void remove()} onBlock={() => void block()} />
  }

  if (status === 'blocked') {
    return (
      <Button variant="secondary" onClick={() => void unblock()} disabled={acting} className={styles.button}>
        {acting ? 'Unblocking…' : 'Unblock'}
      </Button>
    )
  }

  // blocked_by — the other person blocked the viewer. No action available.
  return null
}
