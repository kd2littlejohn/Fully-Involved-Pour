import { Link } from 'react-router-dom'
import type { FriendPouring } from './useFriendsPouring'
import styles from './FriendsPouringRow.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

interface FriendsPouringRowProps {
  friend: FriendPouring
}

export function FriendsPouringRow({ friend }: FriendsPouringRowProps) {
  const name = friend.displayName || friend.username || 'FIP User'
  const content = (
    <>
      <span className={styles.avatarWrap}>
        {friend.photoURL ? (
          <img className={styles.avatarImage} src={friend.photoURL} alt="" />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {initials(name)}
          </span>
        )}
      </span>
      <span className={styles.name}>{name}</span>
      {friend.bottleName ? <span className={styles.bottle}>{friend.bottleName}</span> : null}
    </>
  )

  return friend.username ? (
    <Link to={`/friends/u/${friend.username}`} className={styles.item}>
      {content}
    </Link>
  ) : (
    <div className={styles.item}>{content}</div>
  )
}
