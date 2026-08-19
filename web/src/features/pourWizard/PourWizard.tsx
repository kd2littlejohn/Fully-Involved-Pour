import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { ProgressStepper } from '../../components/ui/ProgressStepper'
import { Button } from '../../components/ui/Button'
import { useWizardDraft } from './useWizardDraft'
import { useUserData, type NewPourInput } from '../../hooks/useUserData'
import { useAuth } from '../../hooks/useAuth'
import { buyAgainToValueScore, computeFipTotal } from '../fip/scoring'
import { shareStoryWithTaggedFriends } from '../friends/shareStoryOnSave'
import type { Pour } from '../../data/types'
import { SessionStep } from './steps/SessionStep'
import { NoseStep } from './steps/NoseStep'
import { PalateStep } from './steps/PalateStep'
import { FinishStep } from './steps/FinishStep'
import { ComplexityStep } from './steps/ComplexityStep'
import { SummaryStep } from './steps/SummaryStep'
import styles from './PourWizard.module.css'

const STEPS = [
  { label: 'Session', Component: SessionStep },
  { label: 'Nose', Component: NoseStep },
  { label: 'Palate', Component: PalateStep },
  { label: 'Finish', Component: FinishStep },
  { label: 'Complexity', Component: ComplexityStep },
  { label: 'Summary', Component: SummaryStep },
]

interface PourWizardProps {
  bottleId: string
  bottleName: string
  existingPour?: Pour
  onClose: () => void
  onSaved?: () => void
}

export function PourWizard({ bottleId, bottleName, existingPour, onClose, onSaved }: PourWizardProps) {
  const isEditing = Boolean(existingPour)
  const { draft, updateDraft, clearDraft } = useWizardDraft(bottleId, existingPour)
  const { user } = useAuth()
  const { userDoc, profile, addPour, updatePour } = useUserData()
  const bottle = userDoc?.bottles.find((b) => b.id === bottleId)
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  const isLastStep = stepIndex === STEPS.length - 1
  const Step = STEPS[stepIndex]?.Component ?? SessionStep

  async function handleSave() {
    setSaving(true)
    const value = buyAgainToValueScore(draft.buyAgain)
    const total = computeFipTotal({ nose: draft.nose, palate: draft.palate, finish: draft.finish, complexity: draft.complexity, value })

    const pour: NewPourInput = {
      bottleId,
      date: draft.date,
      ounces: draft.ounces,
      rating: total,
      occasion: draft.occasion,
      notes: draft.notes,
      companion: draft.companion,
      sharedWithUids: draft.sharedWithUids,
      location: draft.location,
      mood: draft.mood,
      glass: draft.glass,
      weather: draft.weather,
      memory: draft.memory,
      buyAgain: draft.buyAgain,
      wouldBuyAgain: draft.wouldBuyAgain,
      fip: {
        nose: draft.nose,
        palate: draft.palate,
        finish: draft.finish,
        complexity: draft.complexity,
        value,
        total,
        noseAromas: draft.noseAromas,
        palateFlavors: draft.palateFlavors,
        noseNotes: draft.noseNotes,
        palateNotes: draft.palateNotes,
        finishNotes: draft.finishNotes,
        complexityNotes: draft.complexityNotes,
      },
    }

    let savedPour: Pour | undefined
    if (existingPour) {
      const { bottleId: _bottleId, ...patch } = pour
      await updatePour(existingPour.id, patch)
      savedPour = { ...existingPour, ...patch }
    } else {
      savedPour = await addPour(pour)
      clearDraft()
    }

    if (user && savedPour && savedPour.sharedWithUids && savedPour.sharedWithUids.length > 0) {
      void shareStoryWithTaggedFriends(
        {
          uid: user.uid,
          username: userDoc.username ?? '',
          displayName: profile?.displayName || user.displayName || undefined,
          photoURL: profile?.photoURL,
        },
        savedPour,
        bottle,
      )
    }

    setSaving(false)
    onSaved?.()
    onClose()
  }

  function handleSaveDraft() {
    // usePourDraft already persists on every change — this just confirms
    // intent and closes, matching the "Save Draft, resume later" behavior.
    onClose()
  }

  return (
    <Modal title={`${isEditing ? 'Edit' : 'Add a'} Pour Story — ${bottleName}`} onClose={onClose}>
      <ProgressStepper labels={STEPS.map((s) => s.label)} activeIndex={stepIndex} />

      <Step draft={draft} updateDraft={updateDraft} bottle={bottle} />

      <div className={styles.actions}>
        {isEditing ? (
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" onClick={handleSaveDraft} disabled={saving}>
            Save Draft
          </Button>
        )}
        <div className={styles.nextActions}>
          {stepIndex > 0 ? (
            <Button variant="secondary" onClick={() => setStepIndex((i) => i - 1)} disabled={saving}>
              Back
            </Button>
          ) : null}
          {isLastStep ? (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Story'}
            </Button>
          ) : (
            <Button onClick={() => setStepIndex((i) => i + 1)} disabled={saving}>
              Next
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
