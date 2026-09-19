import type { Filter } from './collectionFilters'
import styles from './CollectionSummaryBar.module.css'

export interface CollectionSummary {
  total: number
  open: number
  sealed: number
  finished: number
  lowFill: number
}

interface CollectionSummaryBarProps {
  summary: CollectionSummary
  active: Filter
  onSelect: (filter: Filter) => void
}

// The compact "what do I own" header the batch calls for — five tiles that
// double as one-tap filters (clicking a tile applies the matching My Bar
// view), so this replaces a separate always-visible summary block AND a
// redundant All/Open/Sealed/Finished chip row with one thing. Deliberately
// short: a single row, never pushing the collection itself far down the
// page.
export function CollectionSummaryBar({ summary, active, onSelect }: CollectionSummaryBarProps) {
  const tiles: { filter: Filter; label: string; value: number }[] = [
    { filter: 'all', label: 'Total', value: summary.total },
    { filter: 'open', label: 'Open', value: summary.open },
    { filter: 'sealed', label: 'Sealed', value: summary.sealed },
    { filter: 'finished', label: 'Finished', value: summary.finished },
    { filter: 'low-fill', label: 'Low Fill', value: summary.lowFill },
  ]

  return (
    <div className={styles.bar} role="group" aria-label="Collection summary">
      {tiles.map((tile) => (
        <button
          key={tile.filter}
          type="button"
          className={active === tile.filter ? `${styles.tile} ${styles.tileActive}` : styles.tile}
          aria-pressed={active === tile.filter}
          aria-label={`${tile.label}: ${tile.value} bottles`}
          onClick={() => onSelect(tile.filter)}
        >
          <span className={styles.value}>{tile.value}</span>
          <span className={styles.label}>{tile.label}</span>
        </button>
      ))}
    </div>
  )
}
