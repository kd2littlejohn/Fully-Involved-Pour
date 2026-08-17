import { Link } from 'react-router-dom'
import type { Bottle, Pour } from '../../data/types'
import { getPoursForBottle } from '../bottleDetails/selectors'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { FipScoreBadge } from '../../components/ui/FipScoreBadge'
import { StartAPourButton } from '../startAPour/StartAPourButton'
import styles from './ContinueYourPourStoryCard.module.css'

interface ContinueYourPourStoryCardProps {
  bottle: Bottle
  pours: Pour[]
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Richer than a plain BottleCard: this is the bottle the user is mid-story
// with, so it earns a bigger image and the real per-pour facts (last pour
// date, recent score, recent note, pour count) rather than just a static
// rating — plus a one-tap "Pour Again" instead of a generic link.
export function ContinueYourPourStoryCard({ bottle, pours }: ContinueYourPourStoryCardProps) {
  const bottlePours = getPoursForBottle(pours, bottle.id)
  const latest = bottlePours[0]
  const note = latest?.memory?.trim() || latest?.notes?.trim()

  return (
    <div className={styles.card}>
      <div className={styles.body}>
        <Link to={`/collection/${bottle.id}`} className={styles.name}>
          {bottle.name}
        </Link>
        {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}

        {latest ? (
          <div className={styles.stats}>
            <FipScoreBadge score={latest.rating} />
            <span className={styles.statText}>Last poured {dateFormatter.format(new Date(latest.date))}</span>
            <span className={styles.statText}>
              {bottlePours.length} {bottlePours.length === 1 ? 'pour' : 'pours'}
            </span>
          </div>
        ) : (
          <p className={styles.hint}>No pours logged yet — start this bottle&rsquo;s story.</p>
        )}

        {note ? <p className={styles.note}>{note}</p> : null}

        <div className={styles.actions}>
          <StartAPourButton bottleId={bottle.id} label="Pour Again" />
        </div>
      </div>
      <Link to={`/collection/${bottle.id}`} className={styles.media}>
        {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder name={bottle.name} />}
      </Link>
    </div>
  )
}
