import { Link } from 'react-router-dom'
import type { OpenBottleSummary } from './selectors'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { FillLevelBar } from '../../components/ui/FillLevelBar'
import styles from './OpenBottleCard.module.css'
import { bottlePhotoUrl } from '../photoUpload/bottlePhotoUrl'
import { parseLocalDate } from '../../data/localDate'

interface OpenBottleCardProps {
  summary: OpenBottleSummary
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function lastPouredText(summary: OpenBottleSummary): string {
  if (!summary.lastPouredDate) return 'Not poured yet'
  return `Last poured ${dateFormatter.format(parseLocalDate(summary.lastPouredDate))}`
}

export function OpenBottleCard({ summary }: OpenBottleCardProps) {
  const { bottle, fillPercent } = summary

  return (
    <Link to={`/collection/${bottle.id}`} className={styles.card}>
      <div className={styles.media}>
        {bottlePhotoUrl(bottle) ? <img className={styles.image} src={bottlePhotoUrl(bottle)} alt="" /> : <BottlePlaceholder name={bottle.name} compact />}
      </div>
      <div className={styles.body}>
        <div className={styles.name} title={bottle.name}>
          {bottle.name}
        </div>
        {typeof fillPercent === 'number' ? <FillLevelBar percent={fillPercent} /> : null}
        <div className={styles.meta}>{lastPouredText(summary)}</div>
      </div>
    </Link>
  )
}
