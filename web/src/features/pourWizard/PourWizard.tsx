import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { ProgressStepper } from '../../components/ui/ProgressStepper'
import { Button } from '../../components/ui/Button'
import { useWizardDraft } from './useWizardDraft'
import { useUserData, type NewPourInput } from '../../hooks/useUserData'
import { useAuth } from '../../hooks/useAuth'
import { buyAgainToValueScore, computeFipTotal } from '../fip/scoring'
import { shareStoryWithTaggedFriends } from '../friends/shareStoryOnSave'
import { generateAndSaveTastingSummary } from './tastingSummaryOnSave'
import { uploadAndSaveMemoryPhoto } from './memoryPhotoOnSave'
import { deletePhotoIfSafe } from '../photoUpload/uploadPhoto'
import { companionStringFromPouredWith } from './pourPeople'
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
  const { userDoc, profile, addPour, updatePour, updatePourAiSummary, updatePourMemoryPhoto } = useUserData()
  const { draft, updateDraft, clearDraft } = useWizardDraft(bottleId, existingPour, userDoc.people)
  const { user } = useAuth()
  const bottle = userDoc?.bottles.find((b) => b.id === bottleId)
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  // The memory photo's pending File (or a removal request) lives outside the
  // draft entirely — a File can't survive PourDraft's localStorage
  // round-trip (see draft.ts / useWizardDraft.ts), and nothing here needs
  // resuming across a closed tab the way the rest of the draft does.
  const [memoryPhotoFile, setMemoryPhotoFile] = useState<File | undefined>(undefined)
  const [memoryPhotoRemoved, setMemoryPhotoRemoved] = useState(false)

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
      pouredWith: draft.pouredWith,
      // Mirrors the structured picker back into the legacy string field so
      // every existing companion-reading selector/screen (getCompanionStats,
      // the Bottle Story "Shared Pour" tag, Journal, etc.) keeps working
      // unchanged — see pourPeople.ts.
      companion: companionStringFromPouredWith(draft.pouredWith ?? []),
      sharedWithUids: draft.sharedWithUids,
      // Preserves whatever memory photo already exists unless the user just
      // removed it — a newly picked replacement isn't uploaded yet at this
      // point, so it's attached afterward (see the background upload below).
      memoryPhoto: memoryPhotoRemoved ? undefined : existingPour?.memoryPhoto,
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

    // The pour itself is already saved above regardless of what happens to
    // its memory photo — a removal just deletes the now-orphaned file
    // (best-effort, never awaited), and a replacement upload is deferred
    // entirely until after the normal flow finishes below.
    if (memoryPhotoRemoved && existingPour?.memoryPhoto?.storagePath) {
      void deletePhotoIfSafe(existingPour.memoryPhoto.storagePath)
    }

    setSaving(false)
    onSaved?.()
    onClose()

    // Both fire only after the save + normal UI flow are already done —
    // never awaited, so a slow or failed AI call or photo upload can never
    // delay finishing a pour or lose any of its other data.
    if (savedPour) {
      void generateAndSaveTastingSummary(savedPour, updatePourAiSummary)
      if (user && memoryPhotoFile) {
        void uploadAndSaveMemoryPhoto(user.uid, savedPour, memoryPhotoFile, updatePourMemoryPhoto)
      }
    }
  }

  function handleSaveDraft() {
    // usePourDraft already persists on every change — this just confirms
    // intent and closes, matching the "Save Draft, resume later" behavior.
    onClose()
  }

  return (
    <Modal title={`${isEditing ? 'Edit' : 'Add a'} Pour Story — ${bottleName}`} onClose={onClose}>
      <ProgressStepper labels={STEPS.map((s) => s.label)} activeIndex={stepIndex} />

      <Step
        draft={draft}
        updateDraft={updateDraft}
        bottle={bottle}
        memoryPhoto={{
          existingUrl: existingPour?.memoryPhoto?.url,
          pendingFile: memoryPhotoFile,
          removed: memoryPhotoRemoved,
          onPick: (file) => {
            setMemoryPhotoFile(file)
            setMemoryPhotoRemoved(false)
          },
          onRemove: () => {
            setMemoryPhotoFile(undefined)
            setMemoryPhotoRemoved(true)
          },
        }}
      />

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
