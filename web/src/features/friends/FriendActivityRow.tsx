import { Link } from 'react-router-dom'
import type { ActivityItem } from './activityItem'
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
  item: ActivityItem
  onOpen?: (id: string) => void
}

// One row of "Recent Friend Activity" (see FriendsPage.tsx) — real activity
// only, from either the notifications backend (which was already writing
// these events but had no UI reading them until now) or a derived source
// like shared Blind Room completions. Tapping a row marks it read (when
// there's a real read state to mark) and, where there's somewhere
// meaningful to go, navigates there.
export function FriendActivityRow({ item, onOpen }: FriendActivityRowProps) {
  const content = (
    <>
      <span className={styles.avatarWrap}>
        {item.actorPhotoURL ? (
          <img className={styles.avatarImage} src={item.actorPhotoURL} alt="" />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {initials(item.actorName)}
          </span>
        )}
        {!item.read ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
      </span>
      <span className={styles.body}>
        <span className={styles.text}>{item.text}</span>
        {item.subtitle ? <span className={styles.subtitle}>{item.subtitle}</span> : null}
      </span>
      <span className={styles.time}>{timeAgo(item.timestamp)}</span>
    </>
  )

  if (item.to) {
    return (
      <Link to={item.to} className={styles.row} onClick={() => onOpen?.(item.id)}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={styles.row} onClick={() => onOpen?.(item.id)}>
      {content}
    </button>
  )
}
