import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useBlindRoom } from '../../hooks/useBlindRoom'
import {
  getAllFinalRankings,
  getAllParticipantComparisons,
  getAllParticipantResponses,
  getBlindRoomSecrets,
} from '../../data/repositories/blindRoom'
import { computeRevealHighlights } from '../../features/blindReveal/highlights'
import { generateTastingSummary } from '../../features/blindSommelier/summary'
import type { BlindComparison, BlindFinalRanking, BlindRoomSecrets, BlindTastingResponse } from '../../data/types'
import styles from './BlindRevealPage.module.css'

// Everything on this page only ever resolves once room.state === 'revealed'
// — firestore.rules rejects blindRoomSecrets/responses/ranking reads for a
// non-host participant before then, so a stray fetch attempt just fails
// quietly (see the guard below) rather than leaking anything early.
export function BlindRevealPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { room, participants, loading } = useBlindRoom(roomId)

  const [secrets, setSecrets] = useState<BlindRoomSecrets | undefined>(undefined)
  const [responsesByUid, setResponsesByUid] = useState<Record<string, BlindTastingResponse[]>>({})
  const [rankingsByUid, setRankingsByUid] = useState<Record<string, BlindFinalRanking | undefined>>({})
  const [comparisonsByUid, setComparisonsByUid] = useState<Record<string, BlindComparison[]>>({})
  const [dataLoaded, setDataLoaded] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current || !roomId || room?.state !== 'revealed' || participants.length === 0) return
    fetchedRef.current = true
    const uids = participants.map((p) => p.uid)
    Promise.all([
      getBlindRoomSecrets(roomId),
      getAllParticipantResponses(roomId, uids),
      getAllFinalRankings(roomId, uids),
      getAllParticipantComparisons(roomId, uids),
    ]).then(([secretsResult, responsesResult, rankingsResult, comparisonsResult]) => {
      setSecrets(secretsResult)
      setResponsesByUid(responsesResult)
      setRankingsByUid(rankingsResult)
      setComparisonsByUid(comparisonsResult)
      setDataLoaded(true)
    })
  }, [roomId, room?.state, participants])

  if (authLoading || loading || (room?.state === 'revealed' && !dataLoaded)) {
    return <div className={styles.page} />
  }

  if (!room) {
    return (
      <div className={styles.page}>
        <EmptyState title="We couldn’t find this Blind Room." message="It may have been cancelled or the link is incorrect." />
      </div>
    )
  }

  if (room.state !== 'revealed') {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <EmptyState
            title="Not revealed yet."
            message="The host hasn’t revealed this Blind yet."
            action={<Button onClick={() => navigate(`/blind/${roomId}/lobby`)}>Back to Lobby</Button>}
          />
        </div>
      </div>
    )
  }

  const pours = [...(secrets?.pours ?? [])].sort((a, b) => a.label.localeCompare(b.label))
  const highlights = computeRevealHighlights(pours, responsesByUid, rankingsByUid)
  const myRanking = user ? rankingsByUid[user.uid] : undefined
  const isGroup = participants.length > 1
  const hasNumbers =
    (isGroup && highlights.groupRanking.length > 0) ||
    (isGroup && highlights.groupAverageScores.length > 0) ||
    !!highlights.closestMatchup ||
    (isGroup && !!highlights.mostDivisive) ||
    !!highlights.surprise

  function bottleNameFor(label: string): string {
    return pours.find((p) => p.label === label)?.bottleName ?? `Pour ${label}`
  }

  function scoreFor(uid: string, label: string): number | undefined {
    return responsesByUid[uid]?.find((r) => r.pourLabel === label)?.fipScore
  }

  // Only reads what this viewer themselves recorded — never fabricated, and
  // never drawing on another participant's hidden-until-reveal answers.
  const favoriteLabel = myRanking?.order[0]
  const tastingSummary =
    user && favoriteLabel
      ? generateTastingSummary({
          bottleName: bottleNameFor(favoriteLabel),
          response: responsesByUid[user.uid]?.find((r) => r.pourLabel === favoriteLabel),
          wins: (comparisonsByUid[user.uid] ?? []).filter((c) => c.winnerLabel === favoriteLabel),
        })
      : undefined

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(`/blind/${roomId}/lobby`)}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className={styles.title}>{room.name}</h1>
        <div className={styles.headerSpacer} />
      </div>

      <div className={styles.content}>
        {pours.length === 0 ? (
          <EmptyState title="Nothing to reveal yet." message="This Blind has no recorded pours." />
        ) : (
          <div className={styles.pourList}>
            {pours.map((pour) => (
              <div className={styles.pourCard} key={pour.label}>
                <div className={styles.pourHeader}>
                  <span className={styles.pourLabel}>Pour {pour.label}</span>
                  <span className={styles.pourBottleName}>{pour.bottleName}</span>
                </div>
                {pour.distillery || pour.proof != null ? (
                  <p className={styles.pourMeta}>
                    {[pour.distillery, pour.proof != null ? `${pour.proof} proof` : undefined].filter(Boolean).join(' · ')}
                  </p>
                ) : null}

                <div className={styles.participantResults}>
                  {participants.map((p) => {
                    const response = responsesByUid[p.uid]?.find((r) => r.pourLabel === pour.label)
                    if (!response) return null
                    const guesses = [
                      response.proofGuess != null ? `${response.proofGuess} proof` : undefined,
                      response.ageGuess,
                      response.typeGuess,
                      response.distilleryGuess,
                    ].filter(Boolean)
                    const notes = [response.noseNotes, response.palateNotes, response.finishNotes].filter(Boolean)
                    return (
                      <div className={styles.participantResult} key={p.uid}>
                        <div className={styles.participantResultHeader}>
                          <span className={styles.participantName}>{p.username}</span>
                          {response.fipScore != null ? (
                            <span className={styles.participantScore}>{response.fipScore.toFixed(1)}</span>
                          ) : null}
                        </div>
                        {response.reaction ? <p className={styles.participantReaction}>{response.reaction}</p> : null}
                        {notes.length > 0 ? <p className={styles.participantNotes}>{notes.join(' · ')}</p> : null}
                        {guesses.length > 0 ? (
                          <p className={styles.participantGuess}>Guessed: {guesses.join(', ')}</p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {myRanking ? (
          <div className={styles.rankingsSection}>
            <h2 className={styles.sectionTitle}>Your Ranking</h2>
            {tastingSummary ? <p className={styles.sommelierSummary}>{tastingSummary}</p> : null}
            <div className={styles.rankingCard}>
              <ol className={styles.rankingOrderList}>
                {myRanking.order.map((label) => {
                  const score = user ? scoreFor(user.uid, label) : undefined
                  return (
                    <li key={label}>
                      {bottleNameFor(label)}
                      {score != null ? ` — ${score.toFixed(1)}` : ''}
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        ) : null}

        {isGroup ? (
          <div className={styles.rankingsSection}>
            <h2 className={styles.sectionTitle}>Everyone&rsquo;s Rankings</h2>
            {participants.map((p) => {
              const ranking = rankingsByUid[p.uid]
              if (!ranking) return null
              return (
                <div className={styles.rankingCard} key={p.uid}>
                  <span className={styles.participantName}>{p.username}</span>
                  <ol className={styles.rankingOrderList}>
                    {ranking.order.map((label) => {
                      const score = scoreFor(p.uid, label)
                      return (
                        <li key={label}>
                          {bottleNameFor(label)}
                          {score != null ? ` — ${score.toFixed(1)}` : ''}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )
            })}
          </div>
        ) : null}

        {hasNumbers ? (
          <div className={styles.numbersSection}>
            <h2 className={styles.sectionTitle}>The Numbers</h2>

            {isGroup && highlights.groupRanking.length > 0 ? (
              <div className={styles.numbersBlock}>
                <h3 className={styles.numbersBlockTitle}>Group Ranking</h3>
                <ol className={styles.rankingOrderList}>
                  {highlights.groupRanking.map((p) => (
                    <li key={p.label}>{p.bottleName}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {isGroup && highlights.groupAverageScores.length > 0 ? (
              <div className={styles.numbersBlock}>
                <h3 className={styles.numbersBlockTitle}>Group Average Scores</h3>
                {highlights.groupAverageScores.map((p) => (
                  <div className={styles.numbersRow} key={p.label}>
                    <span>{p.bottleName}</span>
                    <span>{p.avgScore!.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {highlights.closestMatchup ? (
              <p className={styles.numbersCallout}>
                <strong>Closest matchup:</strong> {highlights.closestMatchup.a.bottleName} and{' '}
                {highlights.closestMatchup.b.bottleName} were nearly tied ({highlights.closestMatchup.a.avgScore!.toFixed(1)}{' '}
                vs {highlights.closestMatchup.b.avgScore!.toFixed(1)}).
              </p>
            ) : null}

            {isGroup && highlights.mostDivisive ? (
              <p className={styles.numbersCallout}>
                <strong>Most divisive:</strong> {highlights.mostDivisive.pour.bottleName} split the room — scores were{' '}
                {highlights.mostDivisive.spread.toFixed(1)} points apart.
              </p>
            ) : null}

            {highlights.surprise ? (
              <p className={styles.numbersCallout}>
                <strong>Biggest surprise:</strong> {highlights.surprise.scoreLeader.bottleName} scored highest on average,
                but {highlights.surprise.rankLeader.bottleName} came out on top overall.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
