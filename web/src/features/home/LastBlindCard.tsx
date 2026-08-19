import { Link } from 'react-router-dom'
import type { LastBlindSummary } from './useLastBlindSummary'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { Button } from '../../components/ui/Button'
import styles from './LastBlindCard.module.css'

interface LastBlindCardProps {
  summary: LastBlindSummary
}

// Deliberately doesn't claim a fuller sommelier-style comparison ("...over
// Peerless") — that would need the same multi-participant fetch
// BlindRevealPage does, which useLastBlindSummary skips on purpose to keep
// this a cheap homepage teaser (see useLastBlindSummary.ts). What it says
// instead is still true for every session type this card can show.
export function LastBlindCard({ summary }: LastBlindCardProps) {
  const { room, winningBottleName, winningDistillery, winningImageUrl, score } = summary

  return (
    <div className={styles.card}>
      <p className={styles.subtitle}>You picked the winner!</p>
      <div className={styles.row}>
        <div className={styles.media}>
          <span className={styles.ribbon}>1st Place</span>
          {winningImageUrl ? (
            <img className={styles.image} src={winningImageUrl} alt="" />
          ) : (
            <BottlePlaceholder name={winningBottleName} compact />
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.name}>{winningBottleName}</div>
          {winningDistillery ? <div className={styles.distillery}>{winningDistillery}</div> : null}
          <div className={styles.eyebrow}>From {room.name}</div>
          {typeof score === 'number' ? <div className={styles.score}>Score: {score.toFixed(1)}</div> : null}
          <Link to={`/blind/${room.id}/reveal`}>
            <Button variant="secondary">View Details</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
