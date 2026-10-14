import { Link } from 'react-router-dom'
import { usePourHub } from '../startAPour/usePourHub'
import { useSommelier } from '../sommelier/SommelierProvider'
import styles from './QuickActions.module.css'
import { AxeSymbol } from '../sommelier/AxeMark'

// Three one-tap shortcuts under Tonight's Pick. Each opens what already
// exists: the shared Pour hub (same as the nav's Pour), the AXE sheet, and
// My Bar. No new flows, no second chat.
export function QuickActions() {
  const hub = usePourHub()
  const { openAxe } = useSommelier()

  return (
    <nav className={styles.row} aria-label="Quick actions">
      <button type="button" className={styles.action} onClick={hub.open}>
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4h12l-1.4 14.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8L6 4Z" />
            <path d="M6.6 10h10.8" />
          </svg>
        </span>
        Pour
      </button>
      <button type="button" className={styles.action} onClick={() => openAxe()} aria-haspopup="dialog">
        <AxeSymbol size={24} className={styles.mark} />
        Ask AXE
      </button>
      <Link to="/collection" className={styles.action}>
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3h2v3l1.5 2v12H7V8l1.5-2V3Z" />
            <path d="M15 8h2v2l1.5 2v8h-5v-8L15 10V8Z" />
            <path d="M4 20h16" />
          </svg>
        </span>
        My Bar
      </Link>
      {hub.modal}
    </nav>
  )
}
