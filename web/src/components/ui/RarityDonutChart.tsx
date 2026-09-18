import type { RarityBreakdownRow } from '../../features/rarity/rarityBreakdown'
import type { RarityFilterValue } from '../../features/rarity/rarityFilter'
import styles from './RarityDonutChart.module.css'

interface RarityDonutChartProps {
  rows: RarityBreakdownRow[]
  total: number
  selected: RarityFilterValue
  onSelect: (value: RarityFilterValue) => void
}

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function toggle(current: RarityFilterValue, key: RarityFilterValue, onSelect: (value: RarityFilterValue) => void) {
  onSelect(current === key ? null : key)
}

// A hand-rolled SVG donut (no charting library — none exists in this repo;
// see components/ui/ScoreRing.tsx for the same stroke-dasharray/dashoffset
// ring technique this extends to multiple stacked segments) with an
// interactive legend. Both the ring segments and the legend rows drive the
// same selection state, so either can be used interchangeably — clicking
// the active one again clears it, matching the donut's own click-to-toggle
// behavior. Renders the empty-inventory state instead of attempting to
// draw zero-length segments over a zero total.
export function RarityDonutChart({ rows, total, selected, onSelect }: RarityDonutChartProps) {
  if (total === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.emptyRing} aria-hidden="true" />
        <p className={styles.emptyText}>No bottles yet.</p>
      </div>
    )
  }

  let cumulative = 0
  const segments = rows.map((row) => {
    const arcLength = (row.percent / 100) * CIRCUMFERENCE
    const offset = -cumulative
    cumulative += arcLength
    return { ...row, arcLength, offset }
  })

  return (
    <div className={styles.wrap}>
      <div className={styles.chartArea}>
        <svg className={styles.svg} viewBox="0 0 100 100">
          <circle className={styles.track} cx="50" cy="50" r={RADIUS} />
          {segments.map((segment) =>
            segment.count > 0 ? (
              <circle
                key={segment.key}
                className={styles.segment}
                cx="50"
                cy="50"
                r={RADIUS}
                stroke={segment.color}
                strokeDasharray={`${segment.arcLength} ${CIRCUMFERENCE - segment.arcLength}`}
                strokeDashoffset={segment.offset}
                role="button"
                tabIndex={0}
                aria-pressed={selected === segment.key}
                aria-label={`${segment.label}: ${segment.count} bottles, ${segment.percent} percent`}
                onClick={() => toggle(selected, segment.key, onSelect)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(selected, segment.key, onSelect)
                  }
                }}
              />
            ) : null,
          )}
        </svg>
        <div className={styles.centerLabel}>
          <span className={styles.centerCount}>{total}</span>
          <span className={styles.centerUnit}>bottles</span>
        </div>
      </div>

      <div className={styles.legend} data-testid="rarity-legend">
        <button type="button" className={styles.allButton} aria-pressed={selected === null} onClick={() => onSelect(null)}>
          All Bottles
        </button>
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            className={styles.legendRow}
            aria-pressed={selected === row.key}
            aria-label={`${row.label}: ${row.count} bottles, ${row.percent} percent`}
            onClick={() => toggle(selected, row.key, onSelect)}
          >
            <span className={styles.swatch} style={{ background: row.color }} aria-hidden="true" />
            <span className={styles.legendLabel}>{row.label}</span>
            <span className={styles.legendValue}>
              {row.count} · {row.percent}%
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
