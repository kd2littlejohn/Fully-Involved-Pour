import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { buildRosterView, tastingCountLabel, type RosterRow, type RosterView } from './rosterView'
import type { Party, PartyRosterEntry } from './types'
import styles from './party.module.css'
import w from './whoIsTasting.module.css'

function statusClass(status: RosterRow['status']): string {
  if (status === 'Submitted') return `${w.status} ${w.statusDone}`
  if (status === 'Tasting') return `${w.status} ${w.statusLive}`
  return w.status ?? ''
}

function Row({ row }: { row: RosterRow }) {
  return (
    <li className={w.row}>
      <span className={w.avatar} aria-hidden="true">
        {row.initial}
      </span>
      <span className={w.who}>
        <span className={w.name}>
          {row.name}
          {row.isMe ? <span className={w.you}> (You)</span> : null}
        </span>
        <span className={w.role}>{row.roleLabel}</span>
      </span>
      {row.status ? <span className={statusClass(row.status)}>{row.status}</span> : <span className={w.status}>Not tasting</span>}
    </li>
  )
}

function RosterList({ view, headingId }: { view: RosterView; headingId: string }) {
  return (
    <>
      {view.tasting.length ? (
        <ul className={w.list} aria-labelledby={headingId}>
          {view.tasting.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No one is tasting yet. People appear here as they join.</p>
      )}
      {view.hosting.length ? (
        <>
          <span className={w.subhead}>Hosting, not tasting</span>
          <ul className={w.list} aria-label="Hosting, not tasting">
            {view.hosting.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}

// "Who's Tasting": the same read-only list for hosts, co-hosts and guests.
// Names, roles and status only, from the public roster. Never scores,
// notes or bottles. Managing participants lives on the host dashboard,
// separate from this list.
export function WhoIsTasting({
  party,
  entries,
  myRosterId,
  loading = false,
}: {
  party: Party
  entries: PartyRosterEntry[]
  myRosterId: string | null
  loading?: boolean
}) {
  const view = buildRosterView(party, entries, myRosterId)
  return (
    <section className={styles.card} aria-labelledby="whos-tasting-heading">
      <div className={styles.spread}>
        <h2 id="whos-tasting-heading" className={styles.sectionTitle}>
          Who’s Tasting
        </h2>
        <span className={styles.pill} aria-live="polite">
          {view.count} {view.count === 1 ? 'participant' : 'participants'}
        </span>
      </div>
      {loading ? <p className={styles.muted}>Loading…</p> : <RosterList view={view} headingId="whos-tasting-heading" />}
      <p className={w.footnote}>Visible to everyone in this party · Updates as people join</p>
    </section>
  )
}

// The small "N Tasting" chip near the top of the scoring screen. Tapping it
// shows who's there without leaving the pour.
export function TastingIndicator({ party, entries, myRosterId }: { party: Party; entries: PartyRosterEntry[]; myRosterId: string | null }) {
  const [open, setOpen] = useState(false)
  const view = buildRosterView(party, entries, myRosterId)
  return (
    <>
      <button
        type="button"
        className={w.chip}
        aria-haspopup="dialog"
        aria-label={`${tastingCountLabel(view.count)}. Show who’s tasting`}
        onClick={() => setOpen(true)}
      >
        <span className={w.chipDot} aria-hidden="true" />
        {tastingCountLabel(view.count)}
      </button>
      {open ? (
        <Modal title="Who’s Tasting" onClose={() => setOpen(false)}>
          <div className={styles.stack}>
            <RosterList view={view} headingId="modal-title" />
            <p className={w.footnote}>Visible to everyone in this party · Updates as people join</p>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
