import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { isConflictError, partyErrorMessage, setCategoryState, setPartyProgress } from '../../data/repositories/party'
import { ConfirmDialog } from './ConfirmDialog'
import { GROUP_LABEL } from './dualGroups'
import { flightSubmissions, glassNumber, liveControls, PROGRESS_LABEL, totalGlasses } from './liveProgress'
import type { Party, PartyGroup, PartyProgressCommand, PartyRosterEntry } from './types'
import styles from './party.module.css'

// Host dashboard: the live controls that keep every participant on the
// same glass. Each command carries the seq it was pressed against, so if
// the other host just moved the event, this one is refused and the card
// shows the event's new position (it updates live) instead of jumping
// twice. Reveal and End use the dashboard's existing confirmations.
export function LiveControls({
  party,
  roster,
  onRevealAll,
  onEnd,
}: {
  party: Party
  roster: PartyRosterEntry[]
  onRevealAll: () => void
  onEnd: () => void
}) {
  const live = liveControls(party)
  const { progress, current } = live
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [confirmLock, setConfirmLock] = useState(false)
  const dual = party.format === 'dual'
  const total = totalGlasses(party)
  const glass = glassNumber(party, progress.categoryId, progress.label)

  async function send(command: PartyProgressCommand, target?: { categoryId: string; label?: string }) {
    setBusy(command)
    setError(null)
    setConflict(false)
    try {
      await setPartyProgress(party.id, command, progress.seq, target)
    } catch (err) {
      setConflict(isConflictError(err))
      setError(partyErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function lock() {
    if (!current) return
    setBusy('lock')
    setError(null)
    try {
      await setCategoryState(party.id, current.id, 'voting_closed')
    } catch (err) {
      setError(partyErrorMessage(err))
    } finally {
      setBusy(null)
      setConfirmLock(false)
    }
  }

  const submissions = current ? flightSubmissions(roster, current.id) : null

  return (
    <section className={`${styles.card} ${styles.cardHighlight}`} aria-labelledby="live-heading">
      <div className={styles.spread}>
        <h2 id="live-heading" className={styles.sectionTitle}>
          Live controls
        </h2>
        <span className={`${styles.pill} ${progress.state === 'live' ? styles.pillLive : progress.state === 'ended' ? styles.pillDone : ''}`} role="status">
          {PROGRESS_LABEL[progress.state]}
        </span>
      </div>

      <div aria-live="polite">
        {progress.state === 'lobby' ? (
          <p className={styles.muted}>Everyone waits in the lobby. Start the tasting to pour glass 1 for the whole room.</p>
        ) : current && progress.label ? (
          <p className={styles.subtitle}>
            Glass {glass} of {total} · {current.name}, glass {progress.label}
            {current.state === 'voting_closed' ? ' · submissions locked' : ''}
          </p>
        ) : null}
        {progress.updatedBy && progress.state !== 'lobby' ? (
          <p className={styles.muted} style={{ fontSize: 'var(--fip-text-xs)' }}>
            Last change by {progress.updatedBy}
          </p>
        ) : null}
      </div>

      {submissions ? (
        <div className={styles.statRow} aria-label="Submissions for this flight">
          {(dual ? (['guided', 'blind'] as PartyGroup[]) : []).map((group) => (
            <div key={group} className={styles.stat}>
              <span className={styles.statValue}>
                {submissions[group].submitted}
                <span className={styles.statLabel}> / {submissions[group].total}</span>
              </span>
              <span className={styles.statLabel}>{GROUP_LABEL[group]} submitted</span>
            </div>
          ))}
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {submissions.all.submitted}
              <span className={styles.statLabel}> / {submissions.all.total}</span>
            </span>
            <span className={styles.statLabel}>All submitted</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{submissions.all.started}</span>
            <span className={styles.statLabel}>Still tasting</span>
          </div>
        </div>
      ) : null}

      <div className={styles.row}>
        {live.allowed.start ? (
          <Button onClick={() => send('start')} disabled={busy !== null}>
            {busy === 'start' ? 'Starting…' : 'Start tasting'}
          </Button>
        ) : null}
        {live.allowed.advanceGlass ? (
          <Button onClick={() => send('advanceGlass')} disabled={busy !== null}>
            {busy === 'advanceGlass' ? 'Pouring…' : `Next glass (${live.nextGlass})`}
          </Button>
        ) : null}
        {live.allowed.advanceFlight ? (
          <Button variant={live.allowed.advanceGlass ? 'secondary' : 'primary'} onClick={() => send('advanceFlight')} disabled={busy !== null}>
            {busy === 'advanceFlight' ? 'Moving on…' : `Next flight: ${live.nextFlight?.name}`}
          </Button>
        ) : null}
        {live.allowed.pause ? (
          <Button variant="secondary" onClick={() => send('pause')} disabled={busy !== null}>
            Pause
          </Button>
        ) : null}
        {live.allowed.resume ? (
          <Button onClick={() => send('resume')} disabled={busy !== null}>
            Resume
          </Button>
        ) : null}
        {live.canLock ? (
          <Button variant="secondary" onClick={() => setConfirmLock(true)} disabled={busy !== null}>
            Lock submissions
          </Button>
        ) : null}
        {live.canReveal ? (
          <Button variant="secondary" onClick={onRevealAll} disabled={busy !== null}>
            Reveal results
          </Button>
        ) : null}
        {party.status !== 'completed' && progress.state !== 'lobby' ? (
          <Button variant="ghost" onClick={onEnd} disabled={busy !== null}>
            End event
          </Button>
        ) : null}
      </div>

      {live.allowed.openGlass ? (
        <details>
          <summary className={styles.label} style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
            Open or reopen a glass
          </summary>
          <p className={styles.muted}>Reopening a locked flight keeps every saved score; tasters can keep editing until you lock it again.</p>
          <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
            {party.categories.map((c) => (
              <div key={c.id} className={styles.row} role="group" aria-label={c.name}>
                <span className={styles.muted} style={{ minWidth: 120 }}>
                  {c.name}
                </span>
                {c.sampleLabels.map((label) => {
                  const here = progress.categoryId === c.id && progress.label === label
                  return (
                    <button
                      key={label}
                      type="button"
                      className={styles.choice}
                      style={{ width: 'auto', minWidth: 48, justifyContent: 'center' }}
                      aria-pressed={here}
                      disabled={busy !== null || here || c.state === 'revealed'}
                      onClick={() => send('openGlass', { categoryId: c.id, label })}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {error ? (
        <p className={conflict ? styles.notice : styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {confirmLock && current ? (
        <ConfirmDialog
          title={`Lock submissions for ${current.name}?`}
          message="Tasters can’t change this flight’s scores until you reopen a glass. Nothing saved is lost, and nothing is revealed."
          confirmLabel="Lock submissions"
          busy={busy === 'lock'}
          onCancel={() => setConfirmLock(false)}
          onConfirm={() => void lock()}
        />
      ) : null}
    </section>
  )
}
