import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { QrCode } from './QrCode'
import { ToggleRow } from './PartyChrome'
import { formatJoinCode, partyInviteUrl, shareOrCopy } from './partyLinks'
import { partyErrorMessage, rotateJoinCode, setPartyInvite } from '../../data/repositories/party'
import type { Party } from './types'
import styles from './party.module.css'

const EXPIRY_OPTIONS = [
  { label: 'Never', hours: 0 },
  { label: 'In 3 hours', hours: 3 },
  { label: 'In 12 hours', hours: 12 },
  { label: 'In 24 hours', hours: 24 },
]

export function InvitePanel({ party }: { party: Party }) {
  const [fullScreen, setFullScreen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const url = partyInviteUrl(party.joinCode)
  const completed = party.status === 'completed'
  const expired = party.inviteExpiresAt !== null && party.inviteExpiresAt < Date.now()

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      setMessage(done)
    } catch (err) {
      setMessage(partyErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    const result = await shareOrCopy(party.name, `Join "${party.name}" on Fully Involved Pour — code ${party.joinCode}`, url)
    setMessage(result === 'copied' ? 'Invitation link copied.' : result === 'shared' ? 'Shared.' : 'Couldn’t share — copy the link below instead.')
  }

  return (
    <section className={`${styles.card} ${styles.cardWarm}`} aria-labelledby="invite-heading">
      <div className={styles.spread}>
        <h2 id="invite-heading" className={styles.sectionTitle}>
          Invite guests
        </h2>
        {!party.inviteActive || expired ? <span className={styles.pill}>Joining closed</span> : <span className={`${styles.pill} ${styles.pillLive}`}>Open</span>}
      </div>
      <button type="button" onClick={() => setFullScreen(true)} className={styles.qrFrame} style={{ border: 0, cursor: 'zoom-in' }} aria-label="Show QR code full screen">
        <QrCode value={url} size={200} label={`QR code to join ${party.name}`} />
      </button>
      <p className={styles.joinCode} aria-label={`Party code ${party.joinCode.split('').join(' ')}`}>
        {formatJoinCode(party.joinCode)}
      </p>
      <div className={styles.row}>
        <Button onClick={share} style={{ flex: '1 1 140px' }}>
          Share invite
        </Button>
        <Button variant="secondary" onClick={() => setFullScreen(true)} style={{ flex: '1 1 140px' }}>
          Full-screen QR
        </Button>
      </div>
      <label className={styles.srOnly} htmlFor="invite-url">
        Invitation link
      </label>
      <input id="invite-url" className={styles.input} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      {!completed ? (
        <details>
          <summary className={styles.label} style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
            Invitation settings
          </summary>
          <ToggleRow
            id="invite-active"
            label="Allow new guests to join"
            hint="Guests who already joined keep their access."
            checked={party.inviteActive}
            disabled={busy}
            onChange={(active) => run(() => setPartyInvite(party.id, active, party.inviteExpiresAt), active ? 'Joining reopened.' : 'Joining closed.')}
          />
          <div className={styles.stack} style={{ gap: 'var(--fip-space-2)', paddingTop: 'var(--fip-space-3)' }}>
            <label className={styles.label} htmlFor="invite-expiry">
              Invitation expires
            </label>
            <select
              id="invite-expiry"
              className={styles.input}
              disabled={busy}
              value=""
              onChange={(e) => {
                const hours = Number(e.target.value)
                run(() => setPartyInvite(party.id, party.inviteActive, hours ? Date.now() + hours * 3600_000 : null), 'Expiry updated.')
              }}
            >
              <option value="" disabled>
                {party.inviteExpiresAt ? `${expired ? 'Expired' : 'Expires'} ${new Date(party.inviteExpiresAt).toLocaleString()}` : 'Never'}
              </option>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.label} value={o.hours}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ paddingTop: 'var(--fip-space-3)' }}>
            <Button variant="secondary" disabled={busy} onClick={() => run(() => rotateJoinCode(party.id), 'New code issued. The old code and QR no longer work.')}>
              Issue a new code
            </Button>
          </div>
        </details>
      ) : null}
      <p className={styles.muted} aria-live="polite">
        {message}
      </p>
      {fullScreen ? (
        <Modal title={`Join ${party.name}`} onClose={() => setFullScreen(false)}>
          <div className={styles.stack} style={{ alignItems: 'center' }}>
            <div className={styles.qrFrame}>
              <QrCode value={url} size={Math.min(window.innerWidth - 96, 420)} label={`QR code to join ${party.name}`} />
            </div>
            <p className={styles.joinCode}>{formatJoinCode(party.joinCode)}</p>
            <p className={styles.muted}>Scan with your phone camera. No app or account needed.</p>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
