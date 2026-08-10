import { Badge } from '../ui/Badge'
import styles from './Timeline.module.css'

export interface TimelineEvent {
  id: string
  date: string
  label: string
  detail?: string
  // Present only on events backed by a real Pour Story — lets the caller
  // open a quick view for that pour when the event is clicked. Lifecycle
  // events (added/opened/bottle kill) have no underlying record to show.
  pourId?: string
  bottleId?: string
  // Present only on events backed by a real Memory — same click-through
  // idea as pourId, opening that memory's own detail view instead.
  memoryId?: string
  // A small, real photo tied to this exact dated moment (e.g. a linked
  // Memory's photo) — never a guess at when an undated photo was taken.
  photoUrl?: string
  // Short milestone labels (e.g. "First Pour", "Highest Rated") — restrained
  // by the caller to at most a couple per event, never fabricated.
  tags?: string[]
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface TimelineProps {
  events: TimelineEvent[]
  onEventClick?: (event: TimelineEvent) => void
}

export function Timeline({ events, onEventClick }: TimelineProps) {
  return (
    <div className={styles.timeline}>
      {events.map((event) => {
        const clickable = Boolean(onEventClick && (event.pourId || event.memoryId))
        const content = (
          <>
            <span className={styles.dot} />
            <div className={styles.date}>{dateFormatter.format(new Date(event.date))}</div>
            <div className={styles.labelRow}>
              <div className={styles.label}>{event.label}</div>
              {event.tags?.map((tag) => (
                <Badge key={tag} tone="brass">
                  {tag}
                </Badge>
              ))}
            </div>
            {event.detail ? <div className={styles.detail}>{event.detail}</div> : null}
            {event.photoUrl ? <img className={styles.photo} src={event.photoUrl} alt="" /> : null}
          </>
        )

        if (clickable) {
          return (
            <button
              type="button"
              className={`${styles.event} ${styles.eventClickable}`}
              key={event.id}
              onClick={() => onEventClick?.(event)}
            >
              {content}
            </button>
          )
        }

        return (
          <div className={styles.event} key={event.id}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
