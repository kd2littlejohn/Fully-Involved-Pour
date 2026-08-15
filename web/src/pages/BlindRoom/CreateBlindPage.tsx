import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ProgressStepper } from '../../components/ui/ProgressStepper'
import { Field, controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { createBlindRoom } from '../../data/repositories/blindRoom'
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

  function toggleBottle(id: string) {
    setSelectedBottleIds((prev) => {
      if (prev.includes(id)) return prev.filter((b) => b !== id)
      if (prev.length >= flightSize) return prev
      return [...prev, id]
    })
  }

  function canAdvance(): boolean {
    if (stepKey === 'bottles') return selectedBottleIds.length === flightSize
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
    // Selecting a smaller flight size than what's already picked trims the
    // extra picks so a stale over-selection can't silently outlive the
    // step where the size was chosen.
    if (stepKey === 'flight' && selectedBottleIds.length > flightSize) {
      setSelectedBottleIds((prev) => prev.slice(0, flightSize))
    }
    setStepIndex((i) => i + 1)
  }

  async function handleCreate() {
    if (!user) return
    setCreating(true)
    setError(null)
    try {
      const hostUsername = userDoc.username || user.displayName || 'Host'
      const pours: BlindSecretPour[] = selectedBottleIds.map((id, i) => {
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
        knownLineup: knowledgeMode === 'single' ? selectedBottleIds.map((id) => bottleById.get(id)!.name) : undefined,
        deadline: sessionType === 'challenge' ? new Date(deadlineValue).getTime() : undefined,
        pours,
      })
      navigate(`/blind/${room.id}/lobby`)
    } catch {
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
              onClick={() => setFlightSize(2)}
            >
              <span className={styles.optionTitle}>Head-to-Head</span>
              <span className={styles.optionDescription}>2 pours, side by side.</span>
            </button>
            <button
              type="button"
              className={flightSize >= 3 ? `${styles.optionCard} ${styles.optionCardActive}` : styles.optionCard}
              onClick={() => setFlightSize((prev) => (prev >= 3 ? prev : 3))}
            >
              <span className={styles.optionTitle}>Flight</span>
              <span className={styles.optionDescription}>3–6 pours.</span>
            </button>
            {flightSize >= 3 ? (
              <div className={styles.flightSizeRow}>
                <span className={styles.flightSizeLabel}>Number of pours</span>
                <div className={styles.flightSizeButtons}>
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={flightSize === n ? `${styles.sizeButton} ${styles.sizeButtonActive}` : styles.sizeButton}
                      onClick={() => setFlightSize(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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
              <p className={styles.prompt}>
                Choose {flightSize} bottle{flightSize === 1 ? '' : 's'} ({selectedBottleIds.length}/{flightSize} selected)
              </p>
              {pourableBottles.map((bottle) => {
                const pickedIndex = selectedBottleIds.indexOf(bottle.id)
                const picked = pickedIndex !== -1
                return (
                  <button
                    key={bottle.id}
                    type="button"
                    className={picked ? `${styles.bottleRow} ${styles.bottleRowActive}` : styles.bottleRow}
                    onClick={() => toggleBottle(bottle.id)}
                    disabled={!picked && selectedBottleIds.length >= flightSize}
                  >
                    <span className={styles.bottleImageWrap}>
                      {bottle.imageUrl ? (
                        <img className={styles.bottleImage} src={bottle.imageUrl} alt="" />
                      ) : (
                        <BottlePlaceholder name={bottle.name} />
                      )}
                    </span>
                    <span className={styles.bottleName}>{bottle.name}</span>
                    {picked ? <span className={styles.bottleLetter}>{POUR_LABELS[pickedIndex]}</span> : null}
                  </button>
                )
              })}
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
              <span className={styles.reviewValue}>{sessionType === 'live' ? 'Live Blind' : 'Blind Challenge'}</span>
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
