import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Section } from '../../components/layout/Section'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { getAttendedParties, getHostedParties } from '../../data/repositories/party'
import { formatEventDate, partyStatusLabel } from '../../features/party/partyLabels'
import type { Party } from '../../features/party/types'
import styles from '../../features/party/party.module.css'
import hub from './PartyHubPage.module.css'

function PartyCard({ party, role }: { party: Party; role: 'host' | 'guest' }) {
  const to =
    party.status === 'completed' ? `/party/${party.id}/recap` : role === 'host' ? `/party/${party.id}/host` : `/party/${party.id}`
  const date = formatEventDate(party.eventDate)
  return (
    <Link to={to} className={hub.partyCard}>
      <div className={styles.spread}>
        <span className={hub.partyName}>{party.name}</span>
        <span className={`${styles.pill} ${party.status === 'live' ? styles.pillLive : party.status === 'completed' ? styles.pillDone : ''}`}>
          {partyStatusLabel(party)}
        </span>
      </div>
      <span className={styles.muted}>
        {role === 'host' ? 'You’re hosting' : `Hosted by ${party.hostName}`} · {party.categories.length}{' '}
        {party.categories.length === 1 ? 'round' : 'rounds'} · {party.counts?.guests ?? 0} guests
      </span>
      {date ? <span className={styles.muted}>{date}</span> : null}
    </Link>
  )
}

// Party Mode's front door inside the Blind Room: Create, Join, Resume, Past.
// Solo and Friends blinds live on the main Blind Room page, unchanged.
export function PartyHubPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [hosted, setHosted] = useState<Party[] | null>(null)
  const [attended, setAttended] = useState<Party[]>([])
  const [loadError, setLoadError] = useState(false)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([getHostedParties(user.uid), getAttendedParties(user.uid).catch(() => [])])
      .then(([h, a]) => {
        if (cancelled) return
        setHosted(h)
        setAttended(a)
      })
      .catch((err) => {
        console.error('[party] load parties failed', err)
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  function join(event: FormEvent) {
    event.preventDefault()
    const normalized = code.replace(/[\s-]/g, '').toUpperCase()
    if (normalized) navigate(`/p/${normalized}`)
  }

  const header = (
    <PageHeader eyebrow="Blind Room" title="Party Mode" subtitle="Host a blind tasting for the whole room. Guests join with a QR code — no account needed." />
  )

  const joinCard = (
    <form className={`${styles.card} ${styles.cardWarm}`} onSubmit={join} aria-labelledby="join-heading">
      <h2 id="join-heading" className={styles.sectionTitle}>
        Join a Party
      </h2>
      <p className={styles.muted}>Scan the host’s QR code, or enter the party code.</p>
      <label className={styles.srOnly} htmlFor="hub-code">
        Party code
      </label>
      <input
        id="hub-code"
        className={`${styles.input} ${styles.codeInput}`}
        value={code}
        maxLength={9}
        autoComplete="off"
        autoCapitalize="characters"
        placeholder="ABC 123"
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      <Button type="submit" disabled={!code.trim()}>
        Join Party
      </Button>
    </form>
  )

  if (loading) return header

  if (!user) {
    return (
      <>
        {header}
        <div className={hub.content}>
          {joinCard}
          <EmptyState title="Hosting a tasting?" message="Sign in to create a party. Your guests won’t need an account." action={<SignInButton />} />
        </div>
      </>
    )
  }

  const all = [
    ...(hosted ?? []).map((party) => ({ party, role: 'host' as const })),
    ...attended.map((party) => ({ party, role: 'guest' as const })),
  ]
  const active = all.filter(({ party }) => party.status !== 'completed')
  const past = all.filter(({ party }) => party.status === 'completed').sort((a, b) => (b.party.completedAt ?? 0) - (a.party.completedAt ?? 0))

  return (
    <>
      {header}
      <div className={hub.content}>
        <div className={hub.actions}>
          <Link to="/party/new" className={`${styles.card} ${styles.cardWarm} ${styles.cardHighlight} ${hub.createCard}`}>
            <span className={styles.eyebrow}>Host</span>
            <span className={styles.sectionTitle}>Create a Party</span>
            <span className={styles.muted}>Pick categories, line up the bottles, and we’ll handle the blind letters, QR code and scoring.</span>
          </Link>
          {joinCard}
        </div>

        {loadError ? <p className={styles.error}>We couldn’t load your parties. Check your connection and try again.</p> : null}

        <Section title="Resume an Active Party">
          {hosted === null && !loadError ? (
            <p className={styles.muted}>Loading…</p>
          ) : active.length === 0 ? (
            <p className={styles.muted}>No parties in progress.</p>
          ) : (
            <div className={styles.grid}>
              {active.map(({ party, role }) => (
                <PartyCard key={party.id} party={party} role={role} />
              ))}
            </div>
          )}
        </Section>

        {past.length > 0 ? (
          <Section title="Past Parties">
            <div className={styles.grid}>
              {past.map(({ party, role }) => (
                <PartyCard key={party.id} party={party} role={role} />
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  )
}
