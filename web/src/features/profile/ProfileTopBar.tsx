import { Link } from 'react-router-dom'
import styles from './ProfileTopBar.module.css'

// Rendered as its own row above the rest of the page — independent of
// ProfileHeader's own loading state, so the Friends/Settings icons stay put
// through every visit to Profile instead of popping in only once bottles,
// pours, and the profile doc have all finished loading.
export function ProfileTopBar() {
  return (
    <div className={styles.row}>
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
  )
}
