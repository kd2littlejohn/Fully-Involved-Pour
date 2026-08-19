import { EmptyState } from '../../components/ui/EmptyState'
import type { ProfileMilestone } from './milestones'
import styles from './MilestonesRow.module.css'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MilestonesRow({ milestones }: { milestones: ProfileMilestone[] }) {
  if (milestones.length === 0) {
    return (
      <EmptyState
        title="Milestones will show up here."
        message="Finish a bottle, land a Hall of Fame pour, or complete a Blind tasting to start collecting them."
      />
    )
  }

  return (
    <div className={styles.row}>
      {milestones.map((m) => (
        <div className={styles.card} key={m.id}>
          <div className={styles.label}>{m.label}</div>
          {m.detail ? <div className={styles.detail}>{m.detail}</div> : null}
          <div className={styles.date}>{formatDate(m.date)}</div>
        </div>
      ))}
    </div>
  )
}
