import { formatEventDate } from './partyLabels'
import { glassNumber, progressOf, totalGlasses } from './liveProgress'
import type { Party, PartyRosterEntry } from './types'
import { factsFromParty, type EventFactsInput } from './lobbyFacts'
import styles from './party.module.css'

// The event at a glance: host, presenters, date, who's coming, flights and
// pours, and the guided / blind split. Counts and names only: never a
// bottle, so it's safe on the public join screen.
export function EventFacts({ facts }: { facts: EventFactsInput }) {
  const date = facts.eventDate ? formatEventDate(facts.eventDate) : null
  return (
    <div className={styles.stack} style={{ gap: 'var(--fip-space-3)' }}>
      <dl className={styles.stack} style={{ gap: 'var(--fip-space-1)', margin: 0 }}>
        <div className={styles.row}>
          <dt className={styles.label}>Host</dt>
          <dd style={{ margin: 0 }}>{facts.hostName}</dd>
        </div>
        {facts.presenters.length ? (
          <div className={styles.row}>
            <dt className={styles.label}>{facts.presenters.length === 1 ? 'Professor' : 'Professors'}</dt>
            <dd style={{ margin: 0 }}>{facts.presenters.join(' · ')}</dd>
          </div>
        ) : null}
        {date ? (
          <div className={styles.row}>
            <dt className={styles.label}>Date</dt>
            <dd style={{ margin: 0 }}>{date}</dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {facts.participants ?? 0}
            {facts.capacity ? <span className={styles.statLabel}> / {facts.capacity}</span> : null}
          </span>
          <span className={styles.statLabel}>Participants</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{facts.flights}</span>
          <span className={styles.statLabel}>Flights</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{facts.pours}</span>
          <span className={styles.statLabel}>Pours</span>
        </div>
        {facts.dual && (facts.plannedGuided !== null || facts.plannedBlind !== null) ? (
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {facts.plannedGuided ?? 0} / {facts.plannedBlind ?? 0}
            </span>
            <span className={styles.statLabel}>Guided / Blind</span>
          </div>
        ) : null}
      </div>
      {facts.dual ? (
        <p className={styles.muted}>
          Guided tasters see each bottle and learn as they go. Blind tasters see only glass letters until the reveal. Everyone pours, scores and graduates together.
        </p>
      ) : null}
    </div>
  )
}

// The guest's view of where the room is: the lobby before the start, the
// glass being poured, or a pause. Follows party.progress live.
export function NowPouring({ party, roster }: { party: Party; roster: PartyRosterEntry[] }) {
  const progress = progressOf(party)
  if (progress.state === 'ended' || party.status === 'completed') return null
  if (progress.state === 'lobby') {
    return (
      <section className={`${styles.card} ${styles.cardWarm}`} aria-labelledby="lobby-heading">
        <span className={styles.eyebrow}>Event lobby</span>
        <h2 id="lobby-heading" className={styles.sectionTitle}>
          You’re in. The tasting starts soon.
        </h2>
        <EventFacts facts={factsFromParty(party, roster)} />
        <p className={styles.muted}>This screen moves to glass 1 on its own when your hosts start.</p>
      </section>
    )
  }
  const category = party.categories.find((c) => c.id === progress.categoryId)
  const glass = glassNumber(party, progress.categoryId, progress.label)
  return (
    <div className={`${styles.card} ${progress.state === 'paused' ? styles.cardWarm : styles.cardHighlight}`} role="status" aria-live="polite" data-testid="now-pouring">
      {progress.state === 'paused' ? (
        <>
          <span className={styles.eyebrow}>Paused</span>
          <p className={styles.subtitle}>The hosts paused the tasting. Keep your notes going — they’re kept on this phone and save when it resumes.</p>
        </>
      ) : (
        <>
          <span className={styles.eyebrow}>
            Now pouring · glass {glass} of {totalGlasses(party)}
          </span>
          <p className={styles.subtitle}>
            {category?.name ?? 'Next flight'}
            {progress.label ? ` — Glass ${progress.label}` : ''}
          </p>
        </>
      )}
    </div>
  )
}
