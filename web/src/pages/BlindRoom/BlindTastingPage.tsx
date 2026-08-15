import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { ProgressStepper } from '../../components/ui/ProgressStepper'
import { EmptyState } from '../../components/ui/EmptyState'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useBlindRoom } from '../../hooks/useBlindRoom'
import {
  getComparisons,
  getFinalRanking,
  getTastingResponses,
  lockFinalRanking,
  lockTastingResponse,
  markTastingCompleted,
  markTastingStarted,
  saveComparison,
  saveFinalRanking,
  saveTastingResponse,
} from '../../data/repositories/blindRoom'
import { readBlindGuidanceLevel, writeBlindGuidanceLevel } from '../../data/blindGuidance'
import { QUICK_POUR_REACTIONS } from '../../features/quickPour/reactions'
import { GUIDANCE_OPTIONS, LIKED_CHARACTERISTICS, NOSE_BROAD_FLAVORS, NOSE_DETAILS, FINISH_IMPRESSIONS, finishLengthFor } from '../../features/blindSommelier/vocabulary'
import { COMPARISON_REASONS } from '../../features/blindSommelier/comparisonReasons'
import { activeSubStepsFor, isSubStepAnswered, promptFor } from '../../features/blindSommelier/flow'
import type { BlindComparison, BlindComparisonReason, BlindFinalRanking, BlindGuidanceLevel, BlindTastingResponse } from '../../data/types'
import styles from './BlindTastingPage.module.css'

// Pour labels are generated client-side from pourCount alone — never fetched
// from blindRoomSecrets, which a non-host participant can't read anyway
// (see firestore.rules). This is what keeps the tasting flow blind.
const POUR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const AUTOSAVE_DELAY_MS = 800

type Phase = 'guidance' | 'pour' | 'comparison-pick' | 'comparison-reason' | 'ranking'

interface GuessDraft {
  proofGuess: string
  ageGuess: string
  typeGuess: string
  distilleryGuess: string
}

function blankGuessDraft(): GuessDraft {
  return { proofGuess: '', ageGuess: '', typeGuess: '', distilleryGuess: '' }
}

function guessDraftFromResponse(response: BlindTastingResponse | undefined): GuessDraft {
  if (!response) return blankGuessDraft()
  return {
    proofGuess: response.proofGuess != null ? String(response.proofGuess) : '',
    ageGuess: response.ageGuess ?? '',
    typeGuess: response.typeGuess ?? '',
    distilleryGuess: response.distilleryGuess ?? '',
  }
}

function guessDraftToPatch(draft: GuessDraft) {
  return {
    proofGuess: draft.proofGuess.trim() ? Number(draft.proofGuess) : undefined,
    ageGuess: draft.ageGuess.trim() || undefined,
    typeGuess: draft.typeGuess.trim() || undefined,
    distilleryGuess: draft.distilleryGuess.trim() || undefined,
  }
}

export function BlindTastingPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { room, participants, loading } = useBlindRoom(roomId)

  const [guidanceLevel, setGuidanceLevel] = useState<BlindGuidanceLevel>('guide')
  const [responses, setResponses] = useState<Record<string, BlindTastingResponse>>({})
  const [comparisons, setComparisons] = useState<BlindComparison[]>([])
  const [ranking, setRanking] = useState<BlindFinalRanking | undefined>(undefined)
  const [rankingOrder, setRankingOrder] = useState<string[]>([])
  const [scores, setScores] = useState<Record<string, number | undefined>>({})
  const [dataLoaded, setDataLoaded] = useState(false)

  const [phase, setPhase] = useState<Phase>('guidance')
  const [pourIndex, setPourIndex] = useState(0)
  const [subStepIndex, setSubStepIndex] = useState(0)
  const [pendingPair, setPendingPair] = useState<[string, string] | undefined>(undefined)
  const [comparisonWinner, setComparisonWinner] = useState<string | undefined>(undefined)
  const [guessDraft, setGuessDraft] = useState<GuessDraft>(blankGuessDraft)
  const [locking, setLocking] = useState(false)
  const [lockError, setLockError] = useState<string | null>(null)

  const startedRef = useRef(false)
  const initialPositionRef = useRef(false)
  const guessSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const me = user ? participants.find((p) => p.uid === user.uid) : undefined
  const pourLabels = POUR_LABELS.slice(0, room?.pourCount ?? 0)
  const currentLabel = pourLabels[pourIndex]
  const currentResponse = currentLabel ? responses[currentLabel] : undefined
  const rankingLocked = ranking?.status === 'locked'
  const activeSubSteps = activeSubStepsFor(guidanceLevel, currentResponse?.noseBroad)
  const currentSubStep = activeSubSteps[subStepIndex]

  useEffect(() => {
    if (user) setGuidanceLevel(readBlindGuidanceLevel(user.uid))
  }, [user])

  // Load this participant's own responses, comparisons, and final ranking
  // once — never another participant's (see blindRoom.ts).
  useEffect(() => {
    if (!roomId || !user) return
    let cancelled = false
    Promise.all([getTastingResponses(roomId, user.uid), getComparisons(roomId, user.uid), getFinalRanking(roomId, user.uid)]).then(
      ([list, comparisonList, existingRanking]) => {
        if (cancelled) return
        const byLabel: Record<string, BlindTastingResponse> = {}
        for (const r of list) byLabel[r.pourLabel] = r
        setResponses(byLabel)
        setComparisons(comparisonList)
        setRanking(existingRanking)
        setRankingOrder(existingRanking?.order ?? [])
        setDataLoaded(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [roomId, user])

  // Jump straight to wherever this participant left off — but only once
  // there's actual prior progress. A completely fresh visit stays on the
  // 'guidance' question (the natural start of the experience); a returning
  // visit skips straight past it into the next unanswered question.
  useEffect(() => {
    if (initialPositionRef.current || !dataLoaded || pourLabels.length === 0) return
    initialPositionRef.current = true

    const hasProgress = Object.keys(responses).length > 0 || comparisons.length > 0 || rankingOrder.length > 0
    if (!hasProgress) return

    if (rankingOrder.length === pourLabels.length && ranking?.status === 'locked') {
      setPhase('ranking')
      return
    }

    for (let i = 0; i < pourLabels.length; i++) {
      const label = pourLabels[i]!
      const response = responses[label]
      const steps = activeSubStepsFor(guidanceLevel, response?.noseBroad)
      const firstUnanswered = steps.findIndex((step) => !isSubStepAnswered(step, response))
      if (firstUnanswered !== -1) {
        setPourIndex(i)
        setSubStepIndex(firstUnanswered)
        setPhase('pour')
        return
      }
      if (i > 0 && comparisons.length < i) {
        const opponent = comparisons.length > 0 ? comparisons[comparisons.length - 1]!.winnerLabel : pourLabels[i - 1]!
        setPourIndex(i)
        setPendingPair([opponent, label])
        setPhase('comparison-pick')
        return
      }
    }
    setPhase('ranking')
  }, [dataLoaded, pourLabels, responses, comparisons, rankingOrder, ranking, guidanceLevel])

  // First entry into tasting for this participant.
  useEffect(() => {
    if (!roomId || !user || !me || startedRef.current) return
    if (me.status === 'ready' || me.status === 'joined') {
      startedRef.current = true
      void markTastingStarted(roomId, user.uid)
    }
  }, [roomId, user, me])

  // Extra Challenge guesses only show on a pour's first question, but stay
  // loaded/saved against whichever pour is current regardless.
  useEffect(() => {
    if (!currentLabel) return
    setGuessDraft(guessDraftFromResponse(responses[currentLabel]))
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLabel])

  useEffect(() => {
    if (!roomId || !user || !currentLabel || phase !== 'pour' || !dataLoaded) return
    if (guessSaveTimer.current) clearTimeout(guessSaveTimer.current)
    guessSaveTimer.current = setTimeout(() => {
      void saveTastingResponse(roomId, user.uid, currentLabel, guessDraftToPatch(guessDraft))
    }, AUTOSAVE_DELAY_MS)
    return () => {
      if (guessSaveTimer.current) clearTimeout(guessSaveTimer.current)
    }
  }, [guessDraft, roomId, user, currentLabel, phase, dataLoaded])

  function pickGuidanceLevel(level: BlindGuidanceLevel) {
    setGuidanceLevel(level)
    if (user) writeBlindGuidanceLevel(user.uid, level)
    setPourIndex(0)
    setSubStepIndex(0)
    setPhase('pour')
  }

  function answerCurrentPour(patch: Partial<Omit<BlindTastingResponse, 'pourLabel' | 'status' | 'lockedAt'>>) {
    if (!roomId || !user || !currentLabel) return
    const now = Date.now()
    const updated: BlindTastingResponse = { ...currentResponse, ...patch, pourLabel: currentLabel, status: 'in-progress', updatedAt: now }
    setResponses((prev) => ({ ...prev, [currentLabel]: updated }))
    void saveTastingResponse(roomId, user.uid, currentLabel, patch)

    const steps = activeSubStepsFor(guidanceLevel, updated.noseBroad)
    const nextIndex = subStepIndex + 1
    if (nextIndex < steps.length) {
      setSubStepIndex(nextIndex)
      return
    }
    finishCurrentPour()
  }

  function finishCurrentPour() {
    if (pourIndex === 0) {
      goToNextPourOrRanking()
      return
    }
    const opponent = comparisons.length > 0 ? comparisons[comparisons.length - 1]!.winnerLabel : pourLabels[pourIndex - 1]!
    setPendingPair([opponent, currentLabel!])
    setComparisonWinner(undefined)
    setPhase('comparison-pick')
  }

  function goToNextPourOrRanking() {
    if (pourIndex + 1 < pourLabels.length) {
      setPourIndex((i) => i + 1)
      setSubStepIndex(0)
      setPhase('pour')
    } else {
      setPhase('ranking')
    }
  }

  function pickComparisonWinner(winner: string) {
    setComparisonWinner(winner)
    setPhase('comparison-reason')
  }

  function pickComparisonReason(reason: BlindComparisonReason) {
    if (!roomId || !user || !pendingPair || !comparisonWinner) return
    const comparison: BlindComparison = {
      id: `${pendingPair[0]}-${pendingPair[1]}`,
      pairLabels: pendingPair,
      winnerLabel: comparisonWinner,
      reason,
      updatedAt: Date.now(),
    }
    setComparisons((prev) => [...prev, comparison])
    saveComparison(roomId, user.uid, comparison).catch((err) => console.error('saveComparison failed', err))
    setPendingPair(undefined)
    setComparisonWinner(undefined)
    goToNextPourOrRanking()
  }

  function toggleRank(label: string) {
    if (rankingLocked) return
    setRankingOrder((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]))
  }

  async function handleLockRanking() {
    if (!roomId || !user || locking || rankingOrder.length !== pourLabels.length) return
    setLocking(true)
    setLockError(null)
    try {
      await saveFinalRanking(roomId, user.uid, rankingOrder)
      for (const label of pourLabels) {
        const score = scores[label]
        if (score != null) await saveTastingResponse(roomId, user.uid, label, { fipScore: score })
        await lockTastingResponse(roomId, user.uid, label)
      }
      await lockFinalRanking(roomId, user.uid, rankingOrder)
      const now = Date.now()
      setRanking({ order: rankingOrder, status: 'locked', updatedAt: now, lockedAt: now })
      await markTastingCompleted(roomId, user.uid)
      navigate(`/blind/${roomId}/lobby`)
    } catch (err) {
      console.error('handleLockRanking failed', err)
      setLockError('Could not save your ranking. Check your connection and try again.')
    } finally {
      setLocking(false)
    }
  }

  function handleBack() {
    if (phase === 'guidance') {
      navigate(`/blind/${roomId}/lobby`)
      return
    }
    if (phase === 'pour') {
      if (subStepIndex > 0) {
        setSubStepIndex((i) => i - 1)
        return
      }
      if (pourIndex === 0) {
        setPhase('guidance')
        return
      }
      return
    }
    if (phase === 'comparison-reason') {
      setPhase('comparison-pick')
      return
    }
  }

  const canGoBack =
    phase === 'guidance' ||
    (phase === 'pour' && (subStepIndex > 0 || pourIndex === 0)) ||
    phase === 'comparison-reason'

  if (authLoading || loading || (user && !dataLoaded)) {
    return <div className={styles.page} />
  }

  if (!room) {
    return (
      <div className={styles.page}>
        <EmptyState title="We couldn’t find this Blind Room." message="It may have been cancelled or the link is incorrect." />
      </div>
    )
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <EmptyState title="Sign in to continue." message="Sign in to taste this Blind Room." action={<SignInButton />} />
        </div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <EmptyState title={room.name} message="You haven’t joined this Blind Room yet." />
        </div>
      </div>
    )
  }

  if (room.state !== 'active') {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <EmptyState
            title="Tasting hasn't started yet."
            message="Head back to the lobby and wait for the host to start the Blind."
            action={<Button onClick={() => navigate(`/blind/${roomId}/lobby`)}>Back to Lobby</Button>}
          />
        </div>
      </div>
    )
  }

  const title =
    phase === 'guidance'
      ? 'Let’s Taste'
      : phase === 'ranking'
        ? 'Rank Your Pours'
        : phase === 'comparison-pick' || phase === 'comparison-reason'
          ? 'Which One?'
          : `Pour ${currentLabel}`

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBack}
          aria-label="Back"
          disabled={!canGoBack}
        >
          ←
        </button>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.headerSpacer} />
      </div>

      <div className={styles.content}>
        {phase === 'guidance' ? (
          <>
            <p className={styles.prompt}>How would you like me to guide tonight’s tasting?</p>
            <div className={styles.choiceList}>
              {GUIDANCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    guidanceLevel === option.value ? `${styles.choiceCard} ${styles.choiceCardActive}` : styles.choiceCard
                  }
                  onClick={() => pickGuidanceLevel(option.value)}
                >
                  <span className={styles.choiceCardTitle}>{option.title}</span>
                  <span className={styles.choiceCardDescription}>{option.description}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {phase === 'pour' && currentLabel && currentSubStep ? (
          <>
            <ProgressStepper labels={pourLabels} activeIndex={pourIndex} />

            {room.knowledgeMode === 'single' && room.knownLineup ? (
              <p className={styles.lineupHint}>In this lineup: {room.knownLineup.join(', ')}</p>
            ) : null}

            <p className={styles.prompt}>{promptFor(currentSubStep, currentLabel, currentResponse?.noseBroad)}</p>

            {currentSubStep === 'nose-broad' ? (
              <div className={styles.choiceGrid}>
                {NOSE_BROAD_FLAVORS.map((flavor) => (
                  <button key={flavor} type="button" className={styles.choiceButton} onClick={() => answerCurrentPour({ noseBroad: flavor })}>
                    {flavor}
                  </button>
                ))}
              </div>
            ) : null}

            {currentSubStep === 'nose-detail' && currentResponse?.noseBroad ? (
              <div className={styles.choiceGrid}>
                {(NOSE_DETAILS[currentResponse.noseBroad as keyof typeof NOSE_DETAILS] ?? []).map((detail) => (
                  <button key={detail} type="button" className={styles.choiceButton} onClick={() => answerCurrentPour({ noseDetail: detail })}>
                    {detail}
                  </button>
                ))}
              </div>
            ) : null}

            {currentSubStep === 'reaction' ? (
              <div className={styles.reactionRow}>
                {QUICK_POUR_REACTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={styles.reaction}
                    onClick={() => answerCurrentPour({ reaction: r.label, fipScore: r.score })}
                  >
                    <span className={styles.reactionEmoji} aria-hidden="true">
                      {r.emoji}
                    </span>
                    {r.label}
                  </button>
                ))}
              </div>
            ) : null}

            {currentSubStep === 'liked' ? (
              <div className={styles.choiceGrid}>
                {LIKED_CHARACTERISTICS.map((characteristic) => (
                  <button
                    key={characteristic}
                    type="button"
                    className={styles.choiceButton}
                    onClick={() => answerCurrentPour({ likedCharacteristic: characteristic })}
                  >
                    {characteristic}
                  </button>
                ))}
              </div>
            ) : null}

            {currentSubStep === 'finish' ? (
              <div className={styles.choiceGrid}>
                {FINISH_IMPRESSIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={styles.choiceButton}
                    onClick={() =>
                      answerCurrentPour({ finishImpression: option.label, finishLength: finishLengthFor(option.label) })
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {subStepIndex === 0 ? (
              <details className={styles.guesses}>
                <summary className={styles.guessesSummary}>Extra Challenge — guess the bottle (optional)</summary>
                <div className={styles.guessFields}>
                  <Field label="Proof" htmlFor="taste-proof">
                    <input
                      id="taste-proof"
                      type="number"
                      inputMode="decimal"
                      className={controlClassName}
                      value={guessDraft.proofGuess}
                      onChange={(e) => setGuessDraft((prev) => ({ ...prev, proofGuess: e.target.value }))}
                      placeholder="e.g. 100"
                    />
                  </Field>
                  <Field label="Age" htmlFor="taste-age">
                    <input
                      id="taste-age"
                      type="text"
                      className={controlClassName}
                      value={guessDraft.ageGuess}
                      onChange={(e) => setGuessDraft((prev) => ({ ...prev, ageGuess: e.target.value }))}
                      placeholder="e.g. 8 years"
                    />
                  </Field>
                  <Field label="Type" htmlFor="taste-type">
                    <input
                      id="taste-type"
                      type="text"
                      className={controlClassName}
                      value={guessDraft.typeGuess}
                      onChange={(e) => setGuessDraft((prev) => ({ ...prev, typeGuess: e.target.value }))}
                      placeholder="e.g. Bourbon"
                    />
                  </Field>
                  <Field label="Distillery" htmlFor="taste-distillery">
                    <input
                      id="taste-distillery"
                      type="text"
                      className={controlClassName}
                      value={guessDraft.distilleryGuess}
                      onChange={(e) => setGuessDraft((prev) => ({ ...prev, distilleryGuess: e.target.value }))}
                      placeholder="e.g. Buffalo Trace"
                    />
                  </Field>
                </div>
              </details>
            ) : null}
          </>
        ) : null}

        {(phase === 'comparison-pick' || phase === 'comparison-reason') && pendingPair ? (
          phase === 'comparison-pick' ? (
            <>
              <p className={styles.prompt}>Which one would you rather pour another glass of?</p>
              <div className={styles.comparisonRow}>
                {pendingPair.map((label) => (
                  <button key={label} type="button" className={styles.comparisonButton} onClick={() => pickComparisonWinner(label)}>
                    Pour {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className={styles.prompt}>What gave it the edge?</p>
              <div className={styles.choiceGrid}>
                {COMPARISON_REASONS.map((reason) => (
                  <button
                    key={reason.value}
                    type="button"
                    className={styles.choiceButton}
                    onClick={() => pickComparisonReason(reason.value)}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            </>
          )
        ) : null}

        {phase === 'ranking' ? (
          <>
            <p className={styles.prompt}>Tap in order — favorite first.</p>
            {rankingLocked ? <p className={styles.lockedNote}>Locked in — your ranking can’t be changed.</p> : null}
            <div className={styles.rankingList}>
              {pourLabels.map((label) => {
                const rank = rankingOrder.indexOf(label)
                const picked = rank !== -1
                return (
                  <button
                    key={label}
                    type="button"
                    className={picked ? `${styles.rankingRow} ${styles.rankingRowActive}` : styles.rankingRow}
                    onClick={() => toggleRank(label)}
                    disabled={rankingLocked}
                  >
                    <span className={styles.rankingLabel}>Pour {label}</span>
                    {picked ? <span className={styles.rankingBadge}>{rank + 1}</span> : null}
                  </button>
                )
              })}
            </div>

            {!rankingLocked ? (
              <details className={styles.guesses}>
                <summary className={styles.guessesSummary}>Add FIP scores (optional)</summary>
                <div className={styles.guessFields}>
                  {pourLabels.map((label) => {
                    const value = scores[label] ?? responses[label]?.fipScore ?? 5
                    return (
                      <div className={styles.scoreRow} key={label}>
                        <span className={styles.scoreLabel}>Pour {label}</span>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={0.1}
                          value={value}
                          onChange={(e) => setScores((prev) => ({ ...prev, [label]: Number(e.target.value) }))}
                          aria-label={`FIP score for Pour ${label}`}
                          className={styles.scoreSlider}
                        />
                        <span className={styles.scoreValue}>{value.toFixed(1)}</span>
                      </div>
                    )
                  })}
                </div>
              </details>
            ) : null}

            {lockError ? (
              <p className={styles.error} role="alert">
                {lockError}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={handleBack} disabled={!canGoBack || locking}>
          Back
        </Button>
        {phase === 'ranking' ? (
          rankingLocked ? (
            <Button onClick={() => navigate(`/blind/${roomId}/lobby`)}>Back to Lobby</Button>
          ) : (
            <Button onClick={() => void handleLockRanking()} disabled={rankingOrder.length !== pourLabels.length || locking}>
              {locking ? 'Locking…' : 'Lock Ranking & Finish'}
            </Button>
          )
        ) : null}
      </div>
    </div>
  )
}
