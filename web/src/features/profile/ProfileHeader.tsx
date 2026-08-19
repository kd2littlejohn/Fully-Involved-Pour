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
      <div className={styles.iconRow}>
        <Link to="/friends" className={styles.iconButton} aria-label="Friends">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="16" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
            <path d="M2.5 20c.6-3.6 2.9-5.5 5.5-5.5s4.9 1.9 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M14.5 15c2.1.3 3.6 1.9 4 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </Link>
        <Link to="/settings" className={styles.iconButton} aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M19.4 13.5c.04-.33.06-.66.06-1s-.02-.67-.06-1l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.4.96a7.4 7.4 0 0 0-1.72-1l-.36-2.54a.5.5 0 0 0-.5-.43h-3.84a.5.5 0 0 0-.5.43l-.36 2.54a7.4 7.4 0 0 0-1.72 1l-2.4-.96a.5.5 0 0 0-.6.22L2.75 9.28a.5.5 0 0 0 .12.64L4.9 11.5c-.04.33-.06.66-.06 1s.02.67.06 1L2.87 15.08a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.4-.96a7.4 7.4 0 0 0 1.72 1l.36 2.54a.5.5 0 0 0 .5.43h3.84a.5.5 0 0 0 .5-.43l.36-2.54a7.4 7.4 0 0 0 1.72-1l2.4.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.4 13.5Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

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
