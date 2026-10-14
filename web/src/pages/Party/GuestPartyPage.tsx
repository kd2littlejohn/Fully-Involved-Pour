import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LinkButton } from '../../components/ui/LinkButton'
import { PartyLoading, PartyMessage, PartyPage } from '../../features/party/PartyChrome'
import { ScoringPanel } from '../../features/party/ScoringPanel'
import { MyTake, ResultsView } from '../../features/party/ResultsView'
import { PartyAxeCard } from '../../features/party/PartyAxeCard'
import { KeepYourResults } from '../../features/party/KeepYourResults'
import { useGuestIdentity } from '../../features/party/useGuestIdentity'
import { useMyBallots, useMyGuest, useParty, usePartyResults } from '../../features/party/usePartyData'
import { recallRecoveryCode } from '../../features/party/guestSession'
import { activeCategory, categoryStateLabel, formatScore } from '../../features/party/partyLabels'
import type { PartyCategory } from '../../features/party/types'
import styles from '../../features/party/party.module.css'

function statePillClass(category: PartyCategory): string {
  if (category.state === 'voting_open') return `${styles.pill} ${styles.pillLive}`
  if (category.state === 'revealed') return `${styles.pill} ${styles.pillDone}`
  return styles.pill ?? ''
}

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [followedOpenId, setFollowedOpenId] = useState<string | null>(null)

  // Follow the host: when a new round opens for voting, jump to it.
  const openId = party.data?.categories.find((c) => c.state === 'voting_open')?.id ?? null
  useEffect(() => {
    if (openId && openId !== followedOpenId) {
      setSelectedId(openId)
      setFollowedOpenId(openId)
    }
  }, [openId, followedOpenId])

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
  if (guest.data.revoked) {
    return <PartyMessage title="You’ve left this party" message="The host has removed you from this party." />
  }
  if (party.loading) return <PartyLoading />
  if (!party.data) return <PartyMessage title="Party unavailable" message="We couldn’t load this party. Check your connection and try again." />

  const p = party.data
  const category = p.categories.find((c) => c.id === selectedId) ?? activeCategory(p)
  const myBallot = category ? ballots.data.find((b) => b.categoryId === category.id) : undefined
  const categoryResults = category ? results.data[category.id] : undefined
  const recoveryCode = recallRecoveryCode(p.id)
  const myScores = myBallot
    ? Object.fromEntries(Object.entries(myBallot.scores).map(([label, score]) => [label, score.overall]))
    : {}
  const anyRevealed = Object.keys(results.data).length > 0

  return (
    <PartyPage>
      <section className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
        <span className={styles.eyebrow}>Hi, {guest.data.nickname}</span>
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

      <nav aria-label="Rounds" className={styles.row}>
        {p.categories.map((c, index) => (
          <button
            key={c.id}
            type="button"
            className={styles.choice}
            style={{ width: 'auto' }}
            aria-pressed={category?.id === c.id}
            onClick={() => setSelectedId(c.id)}
          >
            <span>
              {index + 1}. {c.name}
            </span>
            <span className={statePillClass(c)}>{categoryStateLabel(c.state)}</span>
          </button>
        ))}
      </nav>

      {!category ? (
        <p className={styles.muted}>The host hasn’t added any rounds yet.</p>
      ) : (
        <section className={styles.stack} style={{ gap: 'var(--fip-space-4)' }} aria-labelledby="round-heading">
          <div className={styles.stack} style={{ gap: 'var(--fip-space-1)' }}>
            <h2 id="round-heading" className={styles.sectionTitle}>
              {category.name}
            </h2>
            {category.description ? <p className={styles.muted}>{category.description}</p> : null}
            <p className={styles.muted}>
              {category.sampleLabels.length} samples: {category.sampleLabels.join(', ')}
            </p>
          </div>

          {category.state === 'draft' || category.state === 'ready' ? (
            <div className={`${styles.card} ${styles.cardWarm}`} role="status">
              <p className={styles.subtitle}>Up next. Your host will open voting when the pours are ready.</p>
              <p className={styles.muted}>Grab some water and get comfortable — this screen updates on its own.</p>
            </div>
          ) : null}

          {category.state === 'voting_open' && p.status !== 'completed' ? (
            <ScoringPanel key={category.id} party={p} category={category} ballot={myBallot} />
          ) : null}

          {category.state === 'voting_closed' || (category.state === 'voting_open' && p.status === 'completed') ? (
            <div className={`${styles.card} ${styles.cardWarm}`} role="status">
              <p className={styles.subtitle}>Voting is closed. The reveal is up to your host…</p>
              <MyScoresSummary labels={category.sampleLabels} scores={myScores} favorite={myBallot?.favoriteLabel ?? null} />
            </div>
          ) : null}

          {category.state === 'revealed' && categoryResults ? (
            <>
              <MyTake results={categoryResults} myScores={myScores} />
              <ResultsView results={categoryResults} myParticipantKey={guest.data.participantKey} />
              <PartyAxeCard partyId={p.id} categoryId={category.id} />
            </>
          ) : null}
        </section>
      )}

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

function MyScoresSummary({ labels, scores, favorite }: { labels: string[]; scores: Record<string, number>; favorite: string | null }) {
  const scored = labels.filter((l) => scores[l] !== undefined)
  if (!scored.length) return <p className={styles.muted}>You didn’t submit scores for this round.</p>
  return (
    <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
      <span className={styles.label}>Your scores</span>
      <div className={styles.row}>
        {labels.map((l) => (
          <span key={l} className={styles.pill}>
            {l}: {formatScore(scores[l])}
            {favorite === l ? ' ★' : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
