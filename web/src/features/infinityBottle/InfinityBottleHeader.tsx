import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './InfinityBottleHeader.module.css'

const BACK_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

interface InfinityBottleHeaderProps {
  backTo: string
  title: string
  action?: ReactNode
}

// Shared header for every Infinity Bottle screen — same back-icon + title
// row shape as SettingsPage, with an optional right-side action slot (help
// icon on Home, "..." on Blend Breakdown, etc). Navigates to an explicit
// route rather than navigate(-1) so the hierarchy stays predictable
// regardless of how the user arrived at a given screen.
export function InfinityBottleHeader({ backTo, title, action }: InfinityBottleHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={() => navigate(backTo)} aria-label="Back">
        {BACK_ICON}
      </button>
      <h1 className={styles.title}>{title}</h1>
      {action ? <div className={styles.action}>{action}</div> : null}
    </header>
  )
}
