import type { Bottle, Pour } from '../../../data/types'
import { buildJourneyEvents } from '../../../features/bottleDetails/selectors'
import { EmptyState } from '../../../components/ui/EmptyState'
import styles from './JourneyTab.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function JourneyTab({ bottle, pours }: { bottle: Bottle; pours: Pour[] }) {
  const events = buildJourneyEvents(bottle, pours)

  if (events.length === 0) {
    return <EmptyState title="This bottle's journey is just beginning." message="Its story will build as you log pours over time." />
  }

  return (
    <div className={styles.timeline}>
      {events.map((event) => (
        <div className={styles.event} key={event.id}>
          <span className={styles.dot} />
          <div className={styles.date}>{dateFormatter.format(new Date(event.date))}</div>
          <div className={styles.label}>{event.label}</div>
          {event.detail ? <div className={styles.detail}>{event.detail}</div> : null}
        </div>
      ))}
    </div>
  )
}
