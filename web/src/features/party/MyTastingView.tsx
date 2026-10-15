import { useEffect, useState } from 'react'
import { ScoringPanel } from './ScoringPanel'
import { MyTake, ResultsView } from './ResultsView'
import { PartyAxeCard } from './PartyAxeCard'
import { recallMyRound, rememberMyRound } from './guestSession'
import { activeCategory, categoryStateLabel, formatScore } from './partyLabels'
import type { Party, PartyBallot, PartyCategory, PartyCategoryResults, PartyGuest } from './types'
import styles from './party.module.css'

function statePillClass(category: PartyCategory): string {
  if (category.state === 'voting_open') return `${styles.pill} ${styles.pillLive}`
  if (category.state === 'revealed') return `${styles.pill} ${styles.pillDone}`
  return styles.pill ?? ''
}

// One taster's view of the party: which round is up, scoring while voting
// is open, their own scores, and results once the host reveals. Guests see
// it as their whole party page; a host who's tasting too sees it as My
// Tasting on their dashboard. Bottles appear only through revealed results,
// so it stays blind for everyone, host included, until the reveal.
export function MyTastingView({
  party,
  guest,
  ballots,
  results,
  resumeAtLastSample = false,
}: {
  party: Party
  guest: PartyGuest
  ballots: PartyBallot[]
  results: Record<string, PartyCategoryResults>
  resumeAtLastSample?: boolean
}) {
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    const remembered = recallMyRound(party.id)
    return remembered && party.categories.some((c) => c.id === remembered) ? remembered : null
  })
  const [followedOpenId, setFollowedOpenId] = useState<string | null>(null)

  function setSelectedId(id: string) {
    setSelectedIdState(id)
    rememberMyRound(party.id, id)
  }

  // Follow the host: when a new round opens for voting, jump to it.
  const openId = party.categories.find((c) => c.state === 'voting_open')?.id ?? null
  useEffect(() => {
    if (openId && openId !== followedOpenId) {
      setFollowedOpenId(openId)
      // Keep a remembered round only if it's the one that's open.
      setSelectedIdState((current) => (current === openId ? current : openId))
      rememberMyRound(party.id, openId)
    }
  }, [openId, followedOpenId, party.id])

  const category = party.categories.find((c) => c.id === selectedId) ?? activeCategory(party)
  const myBallot = category ? ballots.find((b) => b.categoryId === category.id) : undefined
  const categoryResults = category ? results[category.id] : undefined
  const myScores = myBallot ? Object.fromEntries(Object.entries(myBallot.scores).map(([label, score]) => [label, score.overall])) : {}

  return (
    <>
      <nav aria-label="Rounds" className={styles.row}>
        {party.categories.map((c, index) => (
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
        <section className={styles.stack} style={{ gap: 'var(--fip-space-4)' }} aria-labelledby={`round-heading-${guest.participantKey}`}>
          <div className={styles.stack} style={{ gap: 'var(--fip-space-1)' }}>
            <h2 id={`round-heading-${guest.participantKey}`} className={styles.sectionTitle}>
              {category.name}
            </h2>
            {category.description ? <p className={styles.muted}>{category.description}</p> : null}
            <p className={styles.muted}>
              {category.sampleLabels.length} samples:{' '}
              {category.bottles
                ? category.sampleLabels.map((l) => `${l}. ${category.bottles?.[l]?.name ?? '—'}`).join(' · ')
                : category.sampleLabels.join(', ')}
            </p>
          </div>

          {category.state === 'draft' || category.state === 'ready' ? (
            <div className={`${styles.card} ${styles.cardWarm}`} role="status">
              <p className={styles.subtitle}>
                {guest.isHost
                  ? 'Up next. Open voting from Manage Party when the pours are ready.'
                  : 'Up next. Your host will open voting when the pours are ready.'}
              </p>
              <p className={styles.muted}>Grab some water and get comfortable — this screen updates on its own.</p>
            </div>
          ) : null}

          {guest.isHost && party.format !== 'regular' && party.hostKeyViews?.[category.id] && category.state !== 'revealed' ? (
            <p className={styles.notice} role="note">
              You’ve seen this round’s bottles, so your scores here are marked not fully blind. They still count like everyone else’s.
            </p>
          ) : null}

          {category.state === 'voting_open' && party.status !== 'completed' ? (
            <ScoringPanel key={category.id} party={party} category={category} ballot={myBallot} resumeAtLastSample={resumeAtLastSample} />
          ) : null}

          {category.state === 'voting_closed' || (category.state === 'voting_open' && party.status === 'completed') ? (
            <div className={`${styles.card} ${styles.cardWarm}`} role="status">
              <p className={styles.subtitle}>
                {guest.isHost
                  ? 'Voting is closed. Reveal the bottles from Manage Party when you’re ready.'
                  : 'Voting is closed. The reveal is up to your host…'}
              </p>
              <MyScoresSummary labels={category.sampleLabels} scores={myScores} favorite={myBallot?.favoriteLabel ?? null} />
            </div>
          ) : null}

          {category.state === 'revealed' && categoryResults ? (
            <>
              <MyTake results={categoryResults} myScores={myScores} />
              <ResultsView results={categoryResults} myParticipantKey={guest.participantKey} />
              <PartyAxeCard partyId={party.id} categoryId={category.id} />
            </>
          ) : null}
        </section>
      )}
    </>
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
