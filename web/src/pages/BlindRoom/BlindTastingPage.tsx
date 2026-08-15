import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { ProgressStepper } from '../../components/ui/ProgressStepper'
import { EmptyState } from '../../components/ui/EmptyState'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useBlindRoom } from '../../hooks/useBlindRoom'
import {
  getTastingResponses,
  lockTastingResponse,
  markTastingCompleted,
  markTastingStarted,
  saveTastingResponse,
} from '../../data/repositories/blindRoom'
import { QUICK_POUR_REACTIONS, type QuickPourReaction } from '../../features/quickPour/reactions'
import type { BlindTastingResponse } from '../../data/types'
import styles from './BlindTastingPage.module.css'

// Pour labels are generated client-side from pourCount alone — never fetched
// from blindRoomSecrets, which a non-host participant can't read anyway
// (see firestore.rules). This is what keeps the tasting flow blind.
const POUR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const AUTOSAVE_DELAY_MS = 800

type ResponsePatch = Partial<Omit<BlindTastingResponse, 'pourLabel' | 'status' | 'lockedAt'>>

interface DraftState {
  reaction: string
  noseNotes: string
  palateNotes: string
  finishNotes: string
  proofGuess: string
  ageGuess: string
  typeGuess: string
  distilleryGuess: string
  fipScore: number
  notes: string
}

function blankDraft(): DraftState {
  return {
    reaction: '',
    noseNotes: '',
    palateNotes: '',
    finishNotes: '',
    proofGuess: '',
    ageGuess: '',
    typeGuess: '',
    distilleryGuess: '',
    fipScore: 5,
    notes: '',
  }
}

function draftFromResponse(response: BlindTastingResponse | undefined): DraftState {
  if (!response) return blankDraft()
  return {
    reaction: response.reaction ?? '',
    noseNotes: response.noseNotes ?? '',
    palateNotes: response.palateNotes ?? '',
    finishNotes: response.finishNotes ?? '',
    proofGuess: response.proofGuess != null ? String(response.proofGuess) : '',
    ageGuess: response.ageGuess ?? '',
    typeGuess: response.typeGuess ?? '',
    distilleryGuess: response.distilleryGuess ?? '',
    fipScore: response.fipScore ?? 5,
    notes: response.notes ?? '',
  }
}

function draftToPatch(draft: DraftState): ResponsePatch {
  return {
    reaction: draft.reaction || undefined,
    noseNotes: draft.noseNotes.trim() || undefined,
    palateNotes: draft.palateNotes.trim() || undefined,
    finishNotes: draft.finishNotes.trim() || undefined,
    proofGuess: draft.proofGuess.trim() ? Number(draft.proofGuess) : undefined,
    ageGuess: draft.ageGuess.trim() || undefined,
    typeGuess: draft.typeGuess.trim() || undefined,
    distilleryGuess: draft.distilleryGuess.trim() || undefined,
    fipScore: draft.fipScore,
    notes: draft.notes.trim() || undefined,
  }
}

export function BlindTastingPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { room, participants, loading } = useBlindRoom(roomId)

  const [responses, setResponses] = useState<Record<string, BlindTastingResponse>>({})
  const [responsesLoaded, setResponsesLoaded] = useState(false)
  const [pourIndex, setPourIndex] = useState(0)
  const [draft, setDraft] = useState<DraftState>(blankDraft)
  const [locking, setLocking] = useState(false)
  const startedRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const me = user ? participants.find((p) => p.uid === user.uid) : undefined
  const pourLabels = useMemo(() => POUR_LABELS.slice(0, room?.pourCount ?? 0), [room?.pourCount])
  const currentLabel = pourLabels[pourIndex]
  const currentResponse = currentLabel ? responses[currentLabel] : undefined
  const isLocked = currentResponse?.status === 'locked'

  // Load this participant's own responses once — never another
  // participant's, since getTastingResponses only ever resolves what
  // firestore.rules allows this uid to read (see blindRoom.ts).
  useEffect(() => {
    if (!roomId || !user) return
    let cancelled = false
    getTastingResponses(roomId, user.uid).then((list) => {
      if (cancelled) return
      const byLabel: Record<string, BlindTastingResponse> = {}
      for (const r of list) byLabel[r.pourLabel] = r
      setResponses(byLabel)
      setResponsesLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [roomId, user])

  // First entry into tasting for this participant.
  useEffect(() => {
    if (!roomId || !user || !me || startedRef.current) return
    if (me.status === 'ready' || me.status === 'joined') {
      startedRef.current = true
      void markTastingStarted(roomId, user.uid)
    }
  }, [roomId, user, me])

  // Load the saved draft for whichever pour is currently on screen.
  useEffect(() => {
    if (!currentLabel) return
    setDraft(draftFromResponse(responses[currentLabel]))
  }, [currentLabel, responses])

  // Debounced autosave — never fires once the current pour is locked, and
  // is cancelled cleanly whenever the pour changes or lock happens.
  useEffect(() => {
    if (!roomId || !user || !currentLabel || isLocked || !responsesLoaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveTastingResponse(roomId, user.uid, currentLabel, draftToPatch(draft))
    }, AUTOSAVE_DELAY_MS)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [draft, roomId, user, currentLabel, isLocked, responsesLoaded])

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function pickReaction(reaction: QuickPourReaction) {
    updateDraft({ reaction: reaction.label, fipScore: reaction.score })
  }

  async function handleLock() {
    if (!roomId || !user || !currentLabel || locking) return
    setLocking(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const patch = draftToPatch(draft)
    await saveTastingResponse(roomId, user.uid, currentLabel, patch)
    await lockTastingResponse(roomId, user.uid, currentLabel)

    const now = Date.now()
    const updatedResponses: Record<string, BlindTastingResponse> = {
      ...responses,
      [currentLabel]: { ...patch, pourLabel: currentLabel, status: 'locked', updatedAt: now, lockedAt: now },
    }
    setResponses(updatedResponses)

    const allLocked = pourLabels.every((label) => updatedResponses[label]?.status === 'locked')
    if (allLocked) {
      await markTastingCompleted(roomId, user.uid)
      setLocking(false)
      navigate(`/blind/${roomId}/lobby`)
      return
    }

    setLocking(false)
    setPourIndex((i) => Math.min(i + 1, pourLabels.length - 1))
  }

  function handleBack() {
    if (pourIndex === 0) {
      navigate(`/blind/${roomId}/lobby`)
      return
    }
    setPourIndex((i) => i - 1)
  }

  if (authLoading || loading || (user && !responsesLoaded)) {
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

  const isLastPour = pourIndex === pourLabels.length - 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={handleBack} aria-label="Back">
          ←
        </button>
        <h1 className={styles.title}>Pour {currentLabel}</h1>
        <div className={styles.headerSpacer} />
      </div>

      <div className={styles.content}>
        <ProgressStepper labels={pourLabels} activeIndex={pourIndex} />

        {room.knowledgeMode === 'single' && room.knownLineup ? (
          <p className={styles.lineupHint}>In this lineup: {room.knownLineup.join(', ')}</p>
        ) : null}

        {isLocked ? <p className={styles.lockedNote}>Locked in — this pour can’t be changed.</p> : null}

        <p className={styles.prompt}>First impression?</p>
        <div className={styles.reactionRow}>
          {QUICK_POUR_REACTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={draft.reaction === r.label ? `${styles.reaction} ${styles.reactionActive}` : styles.reaction}
              aria-pressed={draft.reaction === r.label}
              onClick={() => pickReaction(r)}
              disabled={isLocked}
            >
              <span className={styles.reactionEmoji} aria-hidden="true">
                {r.emoji}
              </span>
              {r.label}
            </button>
          ))}
        </div>

        <Field label="Nose" htmlFor="taste-nose">
          <textarea
            id="taste-nose"
            className={controlClassName}
            rows={2}
            value={draft.noseNotes}
            onChange={(e) => updateDraft({ noseNotes: e.target.value })}
            disabled={isLocked}
            placeholder="What do you smell?"
          />
        </Field>
        <Field label="Palate" htmlFor="taste-palate">
          <textarea
            id="taste-palate"
            className={controlClassName}
            rows={2}
            value={draft.palateNotes}
            onChange={(e) => updateDraft({ palateNotes: e.target.value })}
            disabled={isLocked}
            placeholder="What do you taste?"
          />
        </Field>
        <Field label="Finish" htmlFor="taste-finish">
          <textarea
            id="taste-finish"
            className={controlClassName}
            rows={2}
            value={draft.finishNotes}
            onChange={(e) => updateDraft({ finishNotes: e.target.value })}
            disabled={isLocked}
            placeholder="How does it finish?"
          />
        </Field>

        <div className={styles.scoreRow}>
          <span className={styles.scoreLabel}>FIP Score</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={draft.fipScore}
            onChange={(e) => updateDraft({ fipScore: Number(e.target.value) })}
            aria-label="FIP score"
            className={styles.scoreSlider}
            disabled={isLocked}
          />
          <span className={styles.scoreValue}>{draft.fipScore.toFixed(1)}</span>
        </div>

        <details className={styles.guesses}>
          <summary className={styles.guessesSummary}>Guess the bottle (optional)</summary>
          <div className={styles.guessFields}>
            <Field label="Proof" htmlFor="taste-proof">
              <input
                id="taste-proof"
                type="number"
                inputMode="decimal"
                className={controlClassName}
                value={draft.proofGuess}
                onChange={(e) => updateDraft({ proofGuess: e.target.value })}
                disabled={isLocked}
                placeholder="e.g. 100"
              />
            </Field>
            <Field label="Age" htmlFor="taste-age">
              <input
                id="taste-age"
                type="text"
                className={controlClassName}
                value={draft.ageGuess}
                onChange={(e) => updateDraft({ ageGuess: e.target.value })}
                disabled={isLocked}
                placeholder="e.g. 8 years"
              />
            </Field>
            <Field label="Type" htmlFor="taste-type">
              <input
                id="taste-type"
                type="text"
                className={controlClassName}
                value={draft.typeGuess}
                onChange={(e) => updateDraft({ typeGuess: e.target.value })}
                disabled={isLocked}
                placeholder="e.g. Bourbon"
              />
            </Field>
            <Field label="Distillery" htmlFor="taste-distillery">
              <input
                id="taste-distillery"
                type="text"
                className={controlClassName}
                value={draft.distilleryGuess}
                onChange={(e) => updateDraft({ distilleryGuess: e.target.value })}
                disabled={isLocked}
                placeholder="e.g. Buffalo Trace"
              />
            </Field>
          </div>
        </details>

        <Field label="Notes" htmlFor="taste-notes">
          <textarea
            id="taste-notes"
            className={controlClassName}
            rows={2}
            value={draft.notes}
            onChange={(e) => updateDraft({ notes: e.target.value })}
            disabled={isLocked}
            placeholder="Anything else worth remembering…"
          />
        </Field>
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={handleBack} disabled={locking}>
          Back
        </Button>
        {isLocked ? (
          isLastPour ? (
            <Button onClick={() => navigate(`/blind/${roomId}/lobby`)}>Back to Lobby</Button>
          ) : (
            <Button onClick={() => setPourIndex((i) => i + 1)}>Next Pour</Button>
          )
        ) : (
          <Button onClick={() => void handleLock()} disabled={!draft.reaction || locking}>
            {locking ? 'Locking…' : isLastPour ? 'Lock & Finish' : 'Lock & Next'}
          </Button>
        )}
      </div>
    </div>
  )
}
