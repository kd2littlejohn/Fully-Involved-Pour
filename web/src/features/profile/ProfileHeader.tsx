import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import styles from './ProfileHeader.module.css'

interface ProfileHeaderProps {
  photoURL?: string
  displayName: string
  username?: string
  location?: string
  bio?: string
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

function shareProfile(username: string) {
  const url = `${window.location.origin}${window.location.pathname}#/friends/u/${username}`
  const text = `Check out my whiskey journey on Fully Involved Pour.`
  if (navigator.share) {
    navigator.share({ title: 'Fully Involved Pour', text, url }).catch(() => {})
  } else {
    navigator.clipboard.writeText(url).catch(() => {})
  }
}

export function ProfileHeader({ photoURL, displayName, username, location, bio }: ProfileHeaderProps) {
  return (
    <div className={styles.root}>
      <div className={styles.avatarWrap}>
        {photoURL ? (
          <img className={styles.avatar} src={photoURL} alt="" />
        ) : (
          <div className={styles.avatarFallback} aria-hidden="true">
            {initials(displayName)}
          </div>
        )}
      </div>

      <h1 className={styles.name}>{displayName}</h1>
      {username ? <p className={styles.handle}>@{username}</p> : null}
      {location ? <p className={styles.location}>{location}</p> : null}
      {bio ? <p className={styles.bio}>{bio}</p> : null}

      <div className={styles.actionRow}>
        <Link to="/profile/edit">
          <Button variant="secondary" className={styles.editButton}>
            Edit Profile
          </Button>
        </Link>
        {username ? (
          <Button variant="ghost" className={styles.editButton} onClick={() => shareProfile(username)}>
            Share Profile
          </Button>
        ) : null}
      </div>
    </div>
  )
}
