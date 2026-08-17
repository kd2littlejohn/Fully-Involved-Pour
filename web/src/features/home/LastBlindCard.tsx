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
      <div className={styles.media}>
        {winningImageUrl ? (
          <img className={styles.image} src={winningImageUrl} alt="" />
        ) : (
          <BottlePlaceholder name={winningBottleName} compact />
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.eyebrow}>Last Blind</div>
        <div className={styles.name}>{room.name}</div>
        <div className={styles.winner}>
          <span className={styles.trophy} aria-hidden="true">
            🏆
          </span>
          {winningBottleName}
          {winningDistillery ? <span className={styles.distillery}> · {winningDistillery}</span> : null}
        </div>
        {typeof score === 'number' ? <div className={styles.score}>{score.toFixed(1)}</div> : null}
        <p className={styles.summaryText}>You chose it before the labels were revealed.</p>
        <Link to={`/blind/${room.id}/reveal`}>
          <Button variant="secondary">View Results</Button>
        </Link>
      </div>
    </div>
  )
}
