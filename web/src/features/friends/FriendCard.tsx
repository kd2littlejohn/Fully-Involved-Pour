import { Link } from 'react-router-dom'
import type { FriendProfile } from './useFriends'
import styles from './FriendCard.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

// Deliberately no follower/pour-count vanity metrics — just enough to
// recognize someone and start a real interaction.
export function FriendCard({ friend }: { friend: FriendProfile }) {
  const displayName = friend.displayName || friend.username

  return (
    <Link to={`/friends/u/${friend.username}`} className={styles.card}>
      <div className={styles.avatarWrap}>
        {friend.photoURL ? (
          <img className={styles.avatar} src={friend.photoURL} alt="" />
        ) : (
          <div className={styles.avatarFallback} aria-hidden="true">
            {initials(displayName)}
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{displayName}</div>
        <div className={styles.username}>@{friend.username}</div>
        {friend.whiskeyIdentityTags && friend.whiskeyIdentityTags.length > 0 ? (
          <div className={styles.identity}>{friend.whiskeyIdentityTags.slice(0, 3).join(' · ')}</div>
        ) : null}
      </div>
    </Link>
  )
}
