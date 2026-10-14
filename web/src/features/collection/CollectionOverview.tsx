import { useId, useState, type ReactNode } from 'react'
import type { CollectionSummary } from './CollectionSummaryBar'
import styles from './CollectionOverview.module.css'

interface CollectionOverviewProps {
  summary: CollectionSummary
  // Opens on mount when something inside (e.g. a rarity filter picked from
  // the chart) is already in effect, so the active control is never hidden.
  defaultExpanded?: boolean
  // The full breakdown: the interactive rarity chart and the summary tiles.
  children: ReactNode
}

// My Bar's compact collection header: one line of counts (total, open,
// sealed) that expands to the existing rarity chart and summary tiles.
// The counts are the same CollectionSummary the tiles use, so the two can
// never disagree.
export function CollectionOverview({ summary, defaultExpanded = false, children }: CollectionOverviewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const panelId = useId()

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${summary.total} ${summary.total === 1 ? 'bottle' : 'bottles'}, ${summary.open} open, ${summary.sealed} sealed. Collection insights`}
        onClick={() => setExpanded((value) => !value)}
      >
        <svg className={styles.icon} width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="3" y="11" width="4" height="10" rx="1.2" />
          <rect x="10" y="4" width="4" height="17" rx="1.2" />
          <rect x="17" y="8" width="4" height="13" rx="1.2" />
        </svg>
        <span className={styles.text}>
          <span className={styles.total}>
            {summary.total} {summary.total === 1 ? 'Bottle' : 'Bottles'}
          </span>
          <span className={styles.counts}>
            {summary.open} Open · {summary.sealed} Sealed
          </span>
        </span>
        <span className={styles.hint}>{expanded ? 'Hide' : 'Insights'}</span>
        <svg
          className={expanded ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={panelId} className={styles.panel} hidden={!expanded}>
        {expanded ? children : null}
      </div>
    </div>
  )
}
