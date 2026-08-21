import { Link } from 'react-router-dom'
import styles from './ProfileTopBar.module.css'

// Rendered as its own row above the rest of the page — independent of
// ProfileHeader's own loading state, so the Settings icon stays put through
// every visit to Profile instead of popping in only once bottles, pours,
// and the profile doc have all finished loading. Friends dropped out of
// this row in the 2026-08-21 redesign — it's now a primary bottom-nav
// destination, so a second link to it here would just be redundant.
export function ProfileTopBar() {
  return (
    <div className={styles.row}>
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
