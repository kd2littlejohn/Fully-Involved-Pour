import { useEffect, useState } from 'react'
import { ScoringPanel } from './ScoringPanel'
import { MyTake, ResultsView } from './ResultsView'
import { PartyAxeCard } from './PartyAxeCard'
import { SaveToMyTastings } from './SaveToMyTastings'
import { AromaStations, PairingNote } from './EventExtras'
import { GROUP_HINT, GROUP_LABEL } from './dualGroups'
import { recallMyRound, rememberMyRound } from './guestSession'
import { activeCategory, categoryStateLabel, formatScore } from './partyLabels'
import type { Party, PartyBallot, PartyCategory, PartyCategoryResults, PartyGroup, PartyGuest, PartyPublicBottle } from './types'
import styles from './party.module.css'

function statePillClass(category: PartyCategory): string {
  if (category.state === 'voting_open') return `${styles.pill} ${styles.pillLive}`
  if (category.state === 'revealed') return `${styles.pill} ${styles.pillDone}`
  return styles.pill ?? ''
}

// One taster's view of the party: which round is up, scoring while voting
// is open, their own scores, and results once the host reveals. Guests see
// it as their whole party page; a host who's tasting too sees it as My
// Tasting on their dashboard. In a blind party bottles appear only through
// revealed results, host included. In a Dual Experience party the taster's
// group decides: guided tasters get each round's bottles from the guided
// view (which only they can read); blind tasters get nothing until reveal.
export function MyTastingView({
  party,
  guest,
  ballots,
  results,
  resumeAtLastSample = false,
  group = null,
  guidedBottles = {},
}: {
  party: Party
  guest: PartyGuest
  ballots: PartyBallot[]
  results: Record<string, PartyCategoryResults>
  resumeAtLastSample?: boolean
  // Dual Experience only.
  group?: PartyGroup | null
  guidedBottles?: Record<string, Record<string, PartyPublicBottle>>
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
  // Only a guided taster ever has bottles here; the prop is empty otherwise.
  const myBottles = group === 'guided' && category ? guidedBottles[category.id] : undefined
  const visibleBottles = category?.bottles ?? myBottles
  const finishedRound = Boolean(category && category.sampleLabels.length && category.sampleLabels.every((l) => myBallot?.scores?.[l]))

  return (
    <>
      {group ? (
        <div className={`${styles.card} ${styles.cardWarm}`} style={{ padding: 'var(--fip-space-3) var(--fip-space-4)' }}>
          <div className={styles.spread}>
            <span className={`${styles.pill} ${group === 'guided' ? styles.pillLive : ''}`}>{GROUP_LABEL[group]} tasting</span>
            <span className={styles.muted} style={{ fontSize: 'var(--fip-text-xs)' }}>
              {GROUP_HINT[group]}
            </span>
          </div>
        </div>
      ) : null}
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
              {visibleBottles
                ? category.sampleLabels.map((l) => `${l}. ${visibleBottles[l]?.name ?? '—'}`).join(' · ')
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

          {guest.isHost && party.format !== 'regular' && group !== 'guided' && party.hostKeyViews?.[category.id] && category.state !== 'revealed' ? (
            <p className={styles.notice} role="note">
              You’ve seen this round’s bottles, so your scores here are marked not fully blind. They still count like everyone else’s.
            </p>
          ) : null}

          {category.state === 'voting_open' && party.status !== 'completed' ? (
            <ScoringPanel
              key={category.id}
              party={party}
              category={category}
              ballot={myBallot}
              resumeAtLastSample={resumeAtLastSample}
              guidedBottles={myBottles}
            />
          ) : null}

          <PairingNote party={party} category={category} ready={finishedRound || category.state === 'voting_closed' || category.state === 'revealed'} />

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

          {category.state === 'voting_closed' && myBottles ? (
            <SaveToMyTastings party={party} category={category} ballot={myBallot} group={group} guidedBottles={myBottles} />
          ) : null}

          {category.state === 'revealed' && categoryResults ? (
            <>
              <MyTake results={categoryResults} myScores={myScores} />
              <SaveToMyTastings party={party} category={category} results={categoryResults} ballot={myBallot} group={group} />
              <ResultsView results={categoryResults} myParticipantKey={guest.participantKey} />
              <PartyAxeCard partyId={party.id} categoryId={category.id} dual={Boolean(categoryResults.groups)} />
            </>
          ) : null}
        </section>
      )}

      <AromaStations party={party} />
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
