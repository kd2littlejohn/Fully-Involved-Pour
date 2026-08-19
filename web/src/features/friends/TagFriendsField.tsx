import { useFriends } from './useFriends'
import styles from './TagFriendsField.module.css'

interface TagFriendsFieldProps {
  uid: string | undefined
  selectedUids: string[]
  onChange: (uids: string[]) => void
}

// Tap-to-select chips over the user's real friends — renders nothing when
// they have none yet, so it never adds empty UI clutter to the pour flow.
export function TagFriendsField({ uid, selectedUids, onChange }: TagFriendsFieldProps) {
  const { friends, loading } = useFriends(uid)

  if (loading || friends.length === 0) return null

  function toggle(friendUid: string) {
    onChange(selectedUids.includes(friendUid) ? selectedUids.filter((id) => id !== friendUid) : [...selectedUids, friendUid])
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Shared with</div>
      <div className={styles.chips}>
        {friends.map((friend) => {
          const active = selectedUids.includes(friend.uid)
          return (
            <button
              key={friend.uid}
              type="button"
              className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => toggle(friend.uid)}
              aria-pressed={active}
            >
              {friend.displayName || friend.username}
            </button>
          )
        })}
      </div>
    </div>
  )
}
