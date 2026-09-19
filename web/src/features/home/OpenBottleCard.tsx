import { Link } from 'react-router-dom'
import type { OpenBottleSummary } from './selectors'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { FillLevelBar } from '../../components/ui/FillLevelBar'
import styles from './OpenBottleCard.module.css'

interface OpenBottleCardProps {
  summary: OpenBottleSummary
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function lastPouredText(summary: OpenBottleSummary): string {
  if (!summary.lastPouredDate) return 'Not poured yet'
  return `Last poured ${dateFormatter.format(new Date(summary.lastPouredDate))}`
}

export function OpenBottleCard({ summary }: OpenBottleCardProps) {
  const { bottle, fillPercent } = summary

  return (
    <Link to={`/collection/${bottle.id}`} className={styles.card}>
      <div className={styles.media}>
        {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder name={bottle.name} compact />}
      </div>
      <div className={styles.body}>
        <div className={styles.name}>{bottle.name}</div>
        {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
        {typeof fillPercent === 'number' ? <FillLevelBar percent={fillPercent} /> : null}
        <div className={styles.meta}>{lastPouredText(summary)}</div>
      </div>
    </Link>
  )
}
