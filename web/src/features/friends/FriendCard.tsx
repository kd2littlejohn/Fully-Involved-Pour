import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FriendProfile } from './useFriends'
import { RecommendBottleModal } from './RecommendBottleModal'
import styles from './FriendCard.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

interface FriendCardMenuProps {
  friend: FriendProfile
  onRecommend: () => void
}

// Same outside-click-to-close dropdown pattern as AddFriendButton's
// "Friends ▾" menu — kept as its own button/panel rather than nested inside
// the card's profile Link, since a <button> inside an <a> (or vice versa)
// isn't valid HTML and confuses screen readers about what activates what.
function FriendCardMenu({ friend, onRecommend }: FriendCardMenuProps) {
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
    <div className={styles.menuRoot} ref={rootRef}>
      <button
        type="button"
        className={styles.menuButton}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="More actions"
      >
        ⋮
      </button>
      {open ? (
        <div className={styles.menuPanel} role="menu">
          <Link to={`/friends/u/${friend.username}`} className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
            View Profile
          </Link>
          <Link to="/blind" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
            Invite to Blind
          </Link>
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onRecommend()
            }}
          >
            Recommend Bottle
          </button>
        </div>
      ) : null}
    </div>
  )
}

// Deliberately no follower/pour-count vanity metrics — just enough to
// recognize someone and start a real interaction.
export function FriendCard({ friend }: { friend: FriendProfile }) {
  const [showRecommend, setShowRecommend] = useState(false)
  const displayName = friend.displayName || friend.username || ''

  return (
    <div className={styles.card}>
      <Link to={`/friends/u/${friend.username}`} className={styles.mainLink}>
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
      <FriendCardMenu friend={friend} onRecommend={() => setShowRecommend(true)} />
      {showRecommend ? (
        <RecommendBottleModal friendUid={friend.uid} friendName={displayName} onClose={() => setShowRecommend(false)} />
      ) : null}
    </div>
  )
}
