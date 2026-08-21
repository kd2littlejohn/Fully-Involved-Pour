import { Link } from 'react-router-dom'
import type { AppNotification } from '../../data/types'
import { describeNotification } from './notificationCopy'
import { timeAgo } from './timeAgo'
import styles from './FriendActivityRow.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

interface FriendActivityRowProps {
  notification: AppNotification
  onOpen: (id: string) => void
}

// One row of "Recent Friend Activity" (see FriendsPage.tsx) — built from
// the existing notifications backend (data/repositories/notifications.ts),
// which was already writing these events on every meaningful friend
// interaction but had no UI reading them until now. Tapping a row marks it
// read and, where there's somewhere meaningful to go (see
// describeNotification), navigates there.
export function FriendActivityRow({ notification, onOpen }: FriendActivityRowProps) {
  const { text, to } = describeNotification(notification)
  const name = notification.actorDisplayName || notification.actorUsername

  const content = (
    <>
      <span className={styles.avatarWrap}>
        {notification.actorPhotoURL ? (
          <img className={styles.avatarImage} src={notification.actorPhotoURL} alt="" />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {initials(name)}
          </span>
        )}
        {!notification.read ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
      </span>
      <span className={styles.text}>{text}</span>
      <span className={styles.time}>{timeAgo(notification.createdAt)}</span>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={styles.row} onClick={() => onOpen(notification.id)}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={styles.row} onClick={() => onOpen(notification.id)}>
      {content}
    </button>
  )
}
