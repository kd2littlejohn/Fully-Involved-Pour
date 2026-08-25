import type { ScoreEvolutionPoint } from './selectors'
import styles from './ScoreEvolutionChart.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

interface ScoreEvolutionChartProps {
  points: ScoreEvolutionPoint[]
}

const WIDTH = 320
const HEIGHT = 140
const PAD_X = 8
const PAD_TOP = 12
const PAD_BOTTOM = 24

// A small hand-written SVG line — no charting library. Deliberately just
// dots + a connecting line + three y-gridlines (0/5/10): "a single simple
// chart," not a full analytics surface.
export function ScoreEvolutionChart({ points }: ScoreEvolutionChartProps) {
  if (points.length < 2) return null

  const plotWidth = WIDTH - PAD_X * 2
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const xFor = (index: number) => PAD_X + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
  const yFor = (score: number) => PAD_TOP + plotHeight * (1 - Math.max(0, Math.min(10, score)) / 10)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.score).toFixed(1)}`).join(' ')

  // Past a handful of points, every date label would overlap — keep just
  // first/middle/last, matching this app's existing "never fabricate the
  // middle, just don't crowd it" convention for progression displays.
  const labelIndexes =
    points.length <= 5
      ? points.map((_, i) => i)
      : [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]

  return (
    <svg className={styles.svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Score evolution over your tastings">
      {[0, 5, 10].map((gridScore) => (
        <line
          key={gridScore}
          className={styles.gridline}
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={yFor(gridScore)}
          y2={yFor(gridScore)}
        />
      ))}
      <path className={styles.line} d={linePath} fill="none" />
      {points.map((p, i) => (
        <circle key={i} className={styles.dot} cx={xFor(i)} cy={yFor(p.score)} r={3.5} />
      ))}
      {labelIndexes.map((i) => (
        <text
          key={i}
          className={styles.xLabel}
          x={xFor(i)}
          y={HEIGHT - 6}
          textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
        >
          {dateFormatter.format(new Date(points[i]!.date))}
        </text>
      ))}
    </svg>
  )
}
