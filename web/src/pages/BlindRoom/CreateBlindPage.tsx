import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ProgressStepper } from '../../components/ui/ProgressStepper'
import { Field, controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { createBlindRoom, sessionTypeLabel } from '../../data/repositories/blindRoom'
import type { BlindKnowledgeMode, BlindSecretPour, BlindSessionType } from '../../data/types'
import styles from './CreateBlindPage.module.css'

const POUR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

type StepKey = 'session' | 'flight' | 'knowledge' | 'name' | 'bottles' | 'deadline' | 'review'
const STEP_TITLES: Record<StepKey, string> = {
  session: 'Session Type',
  flight: 'Flight',
  knowledge: 'Knowledge Mode',
  name: 'Name',
  bottles: 'Add Bottles',
  deadline: 'Deadline',
  review: 'Review',
}

function stepsFor(sessionType: BlindSessionType): StepKey[] {
  const steps: StepKey[] = ['session', 'flight', 'knowledge', 'name', 'bottles']
  if (sessionType === 'challenge') steps.push('deadline')
  steps.push('review')
  return steps
}

function defaultDeadlineValue(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  d.setHours(20, 0, 0, 0)
  return d.toISOString().slice(0, 16)
}

export function CreateBlindPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { userDoc } = useUserData()

  const [sessionType, setSessionType] = useState<BlindSessionType>('live')
  const [flightSize, setFlightSize] = useState(3)
  const [knowledgeMode, setKnowledgeMode] = useState<BlindKnowledgeMode>('single')
  const [name, setName] = useState('')
  const [selectedBottleIds, setSelectedBottleIds] = useState<string[]>([])
  const [deadlineValue, setDeadlineValue] = useState(defaultDeadlineValue)
  const [stepIndex, setStepIndex] = useState(0)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = stepsFor(sessionType)
  const stepKey = steps[stepIndex] ?? 'session'
  const isLastStep = stepIndex === steps.length - 1

  const pourableBottles = userDoc.bottles.filter((b) => b.status !== 'wishlist')
  const bottleById = new Map(userDoc.bottles.map((b) => [b.id, b]))
  // Slot array, index = pour (A, B, C…), value = bottleId or '' while unset.
  const filledSlotCount = selectedBottleIds.filter(Boolean).length

  // Every place flightSize can change (the Head-to-Head/Flight cards, the
  // Number of Pours dropdown) routes through here so shrinking always warns
  // before silently dropping an already-picked bottle.
  function updateFlightSize(next: number) {
    const dropped = selectedBottleIds.slice(next).filter(Boolean).length
    if (next < flightSize && dropped > 0) {
      const ok = window.confirm(
        `Reducing to ${next} pour${next === 1 ? '' : 's'} will remove ${dropped} already-selected bottle${dropped === 1 ? '' : 's'}. Continue?`,
      )
      if (!ok) return
    }
    setFlightSize(next)
    setSelectedBottleIds((prev) => prev.slice(0, next))
  }

  function setBottleForSlot(index: number, bottleId: string) {
    setSelectedBottleIds((prev) => {
      const next = [...prev]
      while (next.length <= index) next.push('')
      next[index] = bottleId
      return next
    })
  }

  function canAdvance(): boolean {
    if (stepKey === 'bottles') return filledSlotCount === flightSize
    if (stepKey === 'deadline') return new Date(deadlineValue).getTime() > Date.now()
    return true
  }

  function handleBack() {
    if (stepIndex === 0) {
      navigate('/blind')
      return
    }
    setStepIndex((i) => i - 1)
  }

  function handleNext() {
    if (!canAdvance()) return
    setStepIndex((i) => i + 1)
  }

  async function handleCreate() {
    if (!user) return
    setCreating(true)
    setError(null)
    try {
      const hostUsername = userDoc.username || user.displayName || 'Host'
      const bottleIds = selectedBottleIds.slice(0, flightSize)
      const pours: BlindSecretPour[] = bottleIds.map((id, i) => {
        const bottle = bottleById.get(id)!
        return {
          label: POUR_LABELS[i]!,
          bottleId: bottle.id,
          bottleName: bottle.name,
          distillery: bottle.distillery,
          imageUrl: bottle.imageUrl,
          proof: bottle.proof,
        }
      })
      const room = await createBlindRoom({
        hostUid: user.uid,
        hostUsername,
        name: name.trim() || undefined,
        sessionType,
        knowledgeMode,
        pourCount: flightSize,
        knownLineup: knowledgeMode === 'single' ? bottleIds.map((id) => bottleById.get(id)!.name) : undefined,
        deadline: sessionType === 'challenge' ? new Date(deadlineValue).getTime() : undefined,
        pours,
      })
      // Solo has no one else to wait for — skip the lobby and go straight
      // to tasting. Group modes still land in the lobby (invite/ready-up).
      navigate(sessionType === 'solo' ? `/blind/${room.id}/taste` : `/blind/${room.id}/lobby`)
    } catch (err) {
      console.error('[CreateBlindPage] handleCreate failed', { uid: user.uid, sessionType, err })
      setError('Could not create the Blind Room. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{STEP_TITLES[stepKey]}</h1>
      </div>

      <ProgressStepper labels={steps.map((s) => STEP_TITLES[s])} activeIndex={stepIndex} />

      <div className={styles.body}>
        {stepKey === 'session' ? (
          <div className={styles.cardGroup}>
            <button
              type="button"
              className={sessionType === 'solo' ? `${styles.optionCard} ${styles.optionCardActive}` : styles.optionCard}
              onClick={() => setSessionType('solo')}
            >
              <span className={styles.optionTitle}>Solo Blind</span>
              <span className={styles.optionDescription}>Taste by yourself — no label bias, just what you actually prefer.</span>
            </button>
            <button
              type="button"
              className={sessionType === 'live' ? `${styles.optionCard} ${styles.optionCardActive}` : styles.optionCard}
              onClick={() => setSessionType('live')}
            >
              <span className={styles.optionTitle}>Live Blind</span>
              <span className={styles.optionDescription}>Taste together at the same time.</span>
            </button>
            <button
              type="button"
              className={sessionType === 'challenge' ? `${styles.optionCard} ${styles.optionCardActive}` : styles.optionCard}
              onClick={() => setSessionType('challenge')}
            >
              <span className={styles.optionTitle}>Blind Challenge</span>
              <span className={styles.optionDescription}>Taste on your own before a deadline.</span>
            </button>
          </div>
        ) : null}

        {stepKey === 'flight' ? (
          <div className={styles.cardGroup}>
            <button
              type="button"
              className={flightSize === 2 ? `${styles.optionCard} ${styles.optionCardActive}` : styles.optionCard}
              onClick={() => updateFlightSize(2)}
            >
              <span className={styles.optionTitle}>Head-to-Head</span>
              <span className={styles.optionDescription}>2 pours, side by side.</span>
            </button>
            <button
              type="button"
              className={flightSize >= 3 ? `${styles.optionCard} ${styles.optionCardActive}` : styles.optionCard}
              onClick={() => updateFlightSize(flightSize >= 3 ? flightSize : 3)}
            >
              <span className={styles.optionTitle}>Flight</span>
              <span className={styles.optionDescription}>3–6 pours.</span>
            </button>
            <Field label="Number of Pours" htmlFor="blind-pour-count">
              <select
                id="blind-pour-count"
                className={controlClassName}
                value={flightSize}
                onChange={(e) => updateFlightSize(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} Pours
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}

        {stepKey === 'knowledge' ? (
          <div className={styles.cardGroup}>
            <button
              type="button"
              className={knowledgeMode === 'single' ? `${styles.optionCard} ${styles.optionCardActive}` : styles.optionCard}
              onClick={() => setKnowledgeMode('single')}
            >
              <span className={styles.optionTitle}>Single Blind</span>
              <span className={styles.optionDescription}>
                Participants know the bottles in the lineup, but not which pour is which.
              </span>
            </button>
            <button
              type="button"
              className={knowledgeMode === 'double' ? `${styles.optionCard} ${styles.optionCardActive}` : styles.optionCard}
              onClick={() => setKnowledgeMode('double')}
            >
              <span className={styles.optionTitle}>Double Blind</span>
              <span className={styles.optionDescription}>Participants don&rsquo;t know the lineup at all until reveal.</span>
            </button>
          </div>
        ) : null}

        {stepKey === 'name' ? (
          <Field label="Room name (optional)" htmlFor="blind-room-name">
            <input
              id="blind-room-name"
              className={controlClassName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Night Blind"
            />
          </Field>
        ) : null}

        {stepKey === 'bottles' ? (
          pourableBottles.length === 0 ? (
            <EmptyState title="No bottles to pour yet." message="Add a sealed or opened bottle to your bar first." />
          ) : (
            <div className={styles.bottleList}>
              <p className={styles.prompt}>Choose a bottle for each pour.</p>
              {POUR_LABELS.slice(0, flightSize).map((label, index) => (
                <Field key={label} label={`Pour ${label}`} htmlFor={`blind-bottle-${label}`}>
                  <select
                    id={`blind-bottle-${label}`}
                    className={controlClassName}
                    value={selectedBottleIds[index] ?? ''}
                    onChange={(e) => setBottleForSlot(index, e.target.value)}
                  >
                    <option value="">Select Bottle</option>
                    {pourableBottles.map((bottle) => (
                      <option
                        key={bottle.id}
                        value={bottle.id}
                        disabled={selectedBottleIds.includes(bottle.id) && selectedBottleIds[index] !== bottle.id}
                      >
                        {bottle.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          )
        ) : null}

        {stepKey === 'deadline' ? (
          <>
            <Field label="Challenge deadline" htmlFor="blind-deadline">
              <input
                id="blind-deadline"
                type="datetime-local"
                className={controlClassName}
                value={deadlineValue}
                onChange={(e) => setDeadlineValue(e.target.value)}
              />
            </Field>
            {new Date(deadlineValue).getTime() <= Date.now() ? (
              <p className={styles.error} role="alert">
                Pick a deadline in the future.
              </p>
            ) : null}
          </>
        ) : null}

        {stepKey === 'review' ? (
          <div className={styles.reviewList}>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>Session name</span>
              <span className={styles.reviewValue}>{name.trim() || 'Auto-generated'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>Session type</span>
              <span className={styles.reviewValue}>{sessionTypeLabel(sessionType)}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>Knowledge mode</span>
              <span className={styles.reviewValue}>{knowledgeMode === 'single' ? 'Single Blind' : 'Double Blind'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>Pours</span>
              <span className={styles.reviewValue}>{flightSize}</span>
            </div>
            {sessionType === 'challenge' ? (
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Deadline</span>
                <span className={styles.reviewValue}>{new Date(deadlineValue).toLocaleString()}</span>
              </div>
            ) : null}
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={handleBack} disabled={creating}>
          Back
        </Button>
        {isLastStep ? (
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create Blind Room'}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canAdvance()}>
            Continue
          </Button>
        )}
      </div>
    </div>
  )
}
