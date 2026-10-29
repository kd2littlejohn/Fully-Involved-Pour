import { useParams } from 'react-router-dom'
import { LinkButton } from '../../components/ui/LinkButton'
import { PartyLoading, PartyMessage, PartyPage } from '../../features/party/PartyChrome'
import { MyTastingView } from '../../features/party/MyTastingView'
import { KeepYourResults } from '../../features/party/KeepYourResults'
import { useGuestIdentity } from '../../features/party/useGuestIdentity'
import { useGuidedBottles, useMyBallots, useMyGuest, useParty, usePartyResults, usePartyRoster } from '../../features/party/usePartyData'
import { guestGroup } from '../../features/party/dualGroups'
import { TastingIndicator, WhoIsTasting } from '../../features/party/WhoIsTasting'
import { recallRecoveryCode } from '../../features/party/guestSession'
import styles from '../../features/party/party.module.css'

// The guest's whole party on one screen: which round is up, scoring while
// voting is open, their own progress, and results once the host reveals.
// Everything is live — the host opening a round moves guests to it.
export function GuestPartyPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const { user, loading: identityLoading } = useGuestIdentity()
  const guest = useMyGuest(partyId, user?.uid)
  const isGuest = Boolean(guest.data && !guest.data.revoked)
  const party = useParty(partyId, isGuest)
  const ballots = useMyBallots(partyId, user?.uid, isGuest)
  const results = usePartyResults(partyId, isGuest)
  const roster = usePartyRoster(partyId, isGuest)
  // Dual Experience: only a guided guest subscribes to the guided bottles
  // (the rules refuse anyone else anyway).
  const group = party.data ? guestGroup(party.data, guest.data) : null
  const guided = useGuidedBottles(partyId, isGuest && group === 'guided')

  if (identityLoading || (user && guest.loading)) return <PartyLoading />
  if (!user || !guest.data) {
    return (
      <PartyMessage
        title="Join to taste along"
        message="Scan the host’s QR code or enter their party code to join. If you joined on another device, use your recovery code."
        action={<LinkButton to="/p">Enter a party code</LinkButton>}
      />
    )
  }
  if (guest.data.isHost) {
    return (
      <PartyMessage
        title="You’re hosting this party"
        message="Run the party and score your own pours from your dashboard."
        action={<LinkButton to={`/party/${partyId}/host`}>Open your dashboard</LinkButton>}
      />
    )
  }
  if (guest.data.revoked) {
    return <PartyMessage title="You’ve left this party" message="The host has removed you from this party." />
  }
  if (party.loading) return <PartyLoading />
  if (!party.data) return <PartyMessage title="Party unavailable" message="We couldn’t load this party. Check your connection and try again." />

  const p = party.data
  const recoveryCode = recallRecoveryCode(p.id)
  const anyRevealed = Object.keys(results.data).length > 0

  return (
    <PartyPage>
      <section className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
        <div className={styles.spread}>
          <span className={styles.eyebrow}>Hi, {guest.data.nickname}</span>
          <TastingIndicator party={p} entries={roster.data} myRosterId={guest.data.participantKey} />
        </div>
        <h1 className={styles.title}>{p.name}</h1>
        {p.status === 'completed' ? (
          <div className={styles.row}>
            <span className={`${styles.pill} ${styles.pillDone}`}>Wrapped up</span>
            <LinkButton to={`/party/${p.id}/recap`} variant="secondary">
              See the party recap
            </LinkButton>
          </div>
        ) : null}
      </section>

      <MyTastingView party={p} guest={guest.data} ballots={ballots.data} results={results.data} group={group} guidedBottles={guided.data} />

      <WhoIsTasting party={p} entries={roster.data} myRosterId={guest.data.participantKey} loading={roster.loading} />

      {user.isAnonymous && (anyRevealed || p.status === 'completed') ? <KeepYourResults /> : null}

      {recoveryCode ? (
        <details className={styles.card}>
          <summary className={styles.label} style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
            Switching phones? Your recovery code
          </summary>
          <p className={styles.joinCode}>{recoveryCode}</p>
          <p className={styles.muted}>Enter it with the party code on another device to pick up where you left off.</p>
        </details>
      ) : null}
    </PartyPage>
  )
}
