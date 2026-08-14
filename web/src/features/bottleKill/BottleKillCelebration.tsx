import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { StatTile } from '../../components/ui/StatTile'
import { buildBottleKillSummary } from './selectors'
import type { Bottle, Pour } from '../../data/types'
import styles from './BottleKillCelebration.module.css'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

interface BottleKillCelebrationProps {
  bottle: Bottle
  pours: Pour[]
  onClose: () => void
}

// A one-time emotional beat, not a persistent stat block (that's
// BottleStorySummary's job) — shown right when a bottle is marked finished,
// never on later visits, matching "recognize milestones automatically...
// without cheesy gamification."
export function BottleKillCelebration({ bottle, pours, onClose }: BottleKillCelebrationProps) {
  const summary = buildBottleKillSummary(bottle, pours, todayIsoDate())

  const sentence =
    summary.pourCount > 0
      ? `You finished ${bottle.name} after ${summary.pourCount} ${summary.pourCount === 1 ? 'pour' : 'pours'}${
          summary.spanText ? ` over ${summary.spanText}` : ''
        }.`
      : `You finished ${bottle.name}.`

  return (
    <Modal title="🥃 Bottle Kill" onClose={onClose}>
      <p className={styles.sentence}>{sentence}</p>

      {summary.finalScore != null || summary.buyAgainLabel ? (
        <div className={styles.statsRow}>
          {summary.finalScore != null ? <StatTile value={summary.finalScore.toFixed(1)} label="Final Score" /> : null}
          {summary.buyAgainLabel ? <StatTile value={summary.buyAgainLabel} label="Would Replace?" /> : null}
        </div>
      ) : null}

      <Button onClick={onClose} className={styles.dismiss}>
        Nice.
      </Button>
    </Modal>
  )
}
