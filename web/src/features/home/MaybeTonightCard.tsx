import { Link } from 'react-router-dom'
import type { MaybeTonightCandidate } from './selectors'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { StartAPourButton } from '../startAPour/StartAPourButton'
import styles from './MaybeTonightCard.module.css'
import { bottlePhotoUrl } from '../photoUpload/bottlePhotoUrl'

interface MaybeTonightCardProps {
  candidate: MaybeTonightCandidate
}

export function MaybeTonightCard({ candidate }: MaybeTonightCardProps) {
  const { bottle, reason } = candidate

  return (
    <div className={styles.card}>
      <Link to={`/collection/${bottle.id}`} className={styles.media}>
        {bottlePhotoUrl(bottle) ? <img className={styles.image} src={bottlePhotoUrl(bottle)} alt="" /> : <BottlePlaceholder name={bottle.name} compact />}
      </Link>
      <div className={styles.body}>
        <Link to={`/collection/${bottle.id}`} className={styles.name}>
          {bottle.name}
        </Link>
        {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
        <p className={styles.reason}>{reason}</p>
        <div className={styles.action}>
          <StartAPourButton bottleId={bottle.id} label="Start Pour" variant="secondary" />
        </div>
      </div>
    </div>
  )
}
