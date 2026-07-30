import styles from './Timeline.module.css'

export interface TimelineEvent {
  id: string
  date: string
  label: string
  detail?: string
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function Timeline({ events }: { events: TimelineEvent[] }) {
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
