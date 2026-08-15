import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useBlindRoom } from '../../hooks/useBlindRoom'
import {
  getAllFinalRankings,
  getAllParticipantResponses,
  getBlindRoomSecrets,
} from '../../data/repositories/blindRoom'
import type { BlindFinalRanking, BlindRoomSecrets, BlindTastingResponse } from '../../data/types'
import styles from './BlindRevealPage.module.css'

// Everything on this page only ever resolves once room.state === 'revealed'
// — firestore.rules rejects blindRoomSecrets/responses/ranking reads for a
// non-host participant before then, so a stray fetch attempt just fails
// quietly (see the guard below) rather than leaking anything early.
export function BlindRevealPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { loading: authLoading } = useAuth()
  const { room, participants, loading } = useBlindRoom(roomId)

  const [secrets, setSecrets] = useState<BlindRoomSecrets | undefined>(undefined)
  const [responsesByUid, setResponsesByUid] = useState<Record<string, BlindTastingResponse[]>>({})
  const [rankingsByUid, setRankingsByUid] = useState<Record<string, BlindFinalRanking | undefined>>({})
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
    ]).then(([secretsResult, responsesResult, rankingsResult]) => {
      setSecrets(secretsResult)
      setResponsesByUid(responsesResult)
      setRankingsByUid(rankingsResult)
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

        <div className={styles.rankingsSection}>
          <h2 className={styles.sectionTitle}>Final Rankings</h2>
          {participants.map((p) => {
            const ranking = rankingsByUid[p.uid]
            if (!ranking) return null
            return (
              <div className={styles.rankingCard} key={p.uid}>
                <span className={styles.participantName}>{p.username}</span>
                <ol className={styles.rankingOrderList}>
                  {ranking.order.map((label) => {
                    const pour = pours.find((sp) => sp.label === label)
                    return <li key={label}>{pour?.bottleName ?? `Pour ${label}`}</li>
                  })}
                </ol>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
