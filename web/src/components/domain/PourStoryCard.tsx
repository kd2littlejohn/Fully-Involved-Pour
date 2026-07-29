import { Link } from 'react-router-dom'
import type { Pour } from '../../data/types'
import { FipScoreBadge } from '../ui/FipScoreBadge'
import styles from './PourStoryCard.module.css'

interface PourStoryCardProps {
  pour: Pour
  bottleName: string
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function PourStoryCard({ pour, bottleName }: PourStoryCardProps) {
  const metaParts = [dateFormatter.format(new Date(pour.date)), pour.occasion, pour.companion].filter(Boolean)

  return (
    <Link to={`/collection/${pour.bottleId}`} className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.bottleName}>{bottleName}</div>
          <div className={styles.meta}>{metaParts.join(' · ')}</div>
        </div>
        <FipScoreBadge score={pour.rating} />
      </div>
      {pour.memory ? <p className={styles.memory}>{pour.memory}</p> : null}
    </Link>
  )
}
