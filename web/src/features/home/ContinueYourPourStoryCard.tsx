import { Link } from 'react-router-dom'
import type { Bottle, Pour } from '../../data/types'
import { getPoursForBottle } from '../bottleDetails/selectors'
import { parseLocalDate } from '../../data/localDate'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { FipScoreBadge } from '../../components/ui/FipScoreBadge'
import { StartAPourButton } from '../startAPour/StartAPourButton'
import styles from './ContinueYourPourStoryCard.module.css'
import { bottlePhotoUrl } from '../photoUpload/bottlePhotoUrl'

interface ContinueYourPourStoryCardProps {
  bottle: Bottle
  pours: Pour[]
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// The bottle the user is mid-story with, as one compact row: image, name,
// the last tasting (its calendar day, read as a local date) and rating,
// and a one-tap "Pour Again".
export function ContinueYourPourStoryCard({ bottle, pours }: ContinueYourPourStoryCardProps) {
  const bottlePours = getPoursForBottle(pours, bottle.id)
  const latest = bottlePours[0]

  return (
    <div className={styles.card}>
      <Link to={`/collection/${bottle.id}`} className={styles.media} aria-label={`View ${bottle.name}`}>
        {bottlePhotoUrl(bottle) ? <img className={styles.image} src={bottlePhotoUrl(bottle)} alt="" /> : <BottlePlaceholder name={bottle.name} compact />}
      </Link>
      <div className={styles.body}>
        <Link to={`/collection/${bottle.id}`} className={styles.name}>
          {bottle.name}
        </Link>
        {latest ? (
          <div className={styles.stats}>
            <span className={styles.statText}>
              Last tasted {dateFormatter.format(parseLocalDate(latest.date))} · {bottlePours.length} {bottlePours.length === 1 ? 'pour' : 'pours'}
            </span>
            <FipScoreBadge score={latest.rating} />
          </div>
        ) : (
          <p className={styles.hint}>No pours logged yet. Start this bottle&rsquo;s story.</p>
        )}
      </div>
      <div className={styles.action}>
        <StartAPourButton bottleId={bottle.id} label="Pour Again" variant="secondary" />
      </div>
    </div>
  )
}
