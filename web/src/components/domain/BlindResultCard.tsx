import { Link } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import type { BlindRoom } from '../../data/types'
import styles from './BlindResultCard.module.css'

interface BlindResultCardProps {
  room: BlindRoom
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Summarizes a revealed Blind Room from this user's perspective — used on
// the Journey page's Blind Stories section. Deliberately only links to the
// reveal page, not the lobby: this card is about the result, not the
// session's live status (that's what BlindRoomLandingPage's own room card
// is for).
export function BlindResultCard({ room }: BlindResultCardProps) {
  return (
    <Link to={`/blind/${room.id}/reveal`} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{room.name}</span>
        <Badge tone="amber">Revealed</Badge>
      </div>
      <div className={styles.meta}>
        {room.pourCount} {room.pourCount === 1 ? 'pour' : 'pours'} ·{' '}
        {room.knowledgeMode === 'single' ? 'Single Blind' : 'Double Blind'}
      </div>
      {room.revealedAt ? <div className={styles.meta}>{dateFormatter.format(new Date(room.revealedAt))}</div> : null}
    </Link>
  )
}
