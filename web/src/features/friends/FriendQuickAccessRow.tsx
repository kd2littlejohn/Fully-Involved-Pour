import { Link } from 'react-router-dom'
import type { FriendProfile } from './useFriends'
import styles from './FriendQuickAccessRow.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

interface FriendQuickAccessRowProps {
  friend: FriendProfile
}

// The compact "Your Friends" preview on FriendsPage's Shared/home tab —
// quick access to a Friend Profile without switching to the Friends tab,
// which stays the full listing (with the "⋮" contextual menu — see
// FriendCard.tsx).
export function FriendQuickAccessRow({ friend }: FriendQuickAccessRowProps) {
  const name = friend.displayName || friend.username || 'FIP User'
  return (
    <Link to={`/friends/u/${friend.username}`} className={styles.item}>
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
    </Link>
  )
}
