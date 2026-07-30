import { useState } from 'react'
import { usePourDraft } from '../../hooks/usePourDraft'
import { blankDraft, pourToDraft, type PourDraft } from './draft'
import type { Pour } from '../../data/types'

interface WizardDraft {
  draft: PourDraft
  updateDraft: (patch: Partial<PourDraft>) => void
  clearDraft: () => void
}

// Create mode persists to localStorage per bottle (resumable "start a new
// story" draft). Edit mode seeds from the existing pour and stays local —
// there's nothing meaningful to "resume" when editing already-saved data.
export function useWizardDraft(bottleId: string, existingPour: Pour | undefined): WizardDraft {
  const persisted = usePourDraft(bottleId)
  const [editDraft, setEditDraft] = useState<PourDraft>(() => (existingPour ? pourToDraft(existingPour) : blankDraft()))

  if (existingPour) {
    return {
      draft: editDraft,
      updateDraft: (patch) => setEditDraft((prev) => ({ ...prev, ...patch })),
      clearDraft: () => {},
    }
  }

  return persisted
}
