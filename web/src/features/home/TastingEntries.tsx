import { useId } from 'react'
import { Link } from 'react-router-dom'
import { usePourHub } from '../startAPour/usePourHub'
import styles from './TastingEntries.module.css'

// Home's two ways to taste, kept distinct: a regular tasting of a bottle
// you can see (the existing Pour Story, starting from a bottle in My Bar),
// and the Blind Room (Solo, Friends, Party Mode).
export function TastingEntries({ hasBottles }: { hasBottles: boolean }) {
  const hub = usePourHub()
  const logId = useId()

  return (
    <nav className={styles.row} aria-label="Tastings">
      {hasBottles ? (
        <button type="button" className={styles.entry} onClick={hub.openTasting} aria-labelledby={`${logId}-title ${logId}-meta`}>
          <span className={styles.icon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h10l-1 7a4 4 0 0 1-8 0L7 3Z" />
              <path d="M12 14v5" />
              <path d="M8.5 21h7" />
            </svg>
          </span>
          <span className={styles.text}>
            <span id={`${logId}-title`} className={styles.title}>
              Log a Tasting
            </span>
            <span id={`${logId}-meta`} className={styles.meta}>
              Pick a bottle from My Bar, then score and note it.
            </span>
          </span>
        </button>
      ) : (
        <Link to="/bottles/new" className={styles.entry}>
          <span className={styles.icon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h10l-1 7a4 4 0 0 1-8 0L7 3Z" />
              <path d="M12 14v5" />
              <path d="M8.5 21h7" />
            </svg>
          </span>
          <span className={styles.text}>
            <span className={styles.title}>Log a Tasting</span>
            <span className={styles.meta}>Add a bottle to My Bar first.</span>
          </span>
        </Link>
      )}
      <Link to="/blind" className={styles.entry}>
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <path d="M4 20 20 4" />
          </svg>
        </span>
        <span className={styles.text}>
          <span className={styles.title}>Blind Tastings</span>
          <span className={styles.meta}>Solo, with friends, or host a tasting party.</span>
        </span>
      </Link>
      {hub.modal}
    </nav>
  )
}
