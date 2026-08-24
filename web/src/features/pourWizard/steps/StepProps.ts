import type { Bottle } from '../../../data/types'
import type { PourDraft } from '../draft'

// The pending/existing memory-photo file state lives outside PourDraft (a
// File can't survive PourDraft's localStorage round-trip — see
// PourWizard.tsx) — passed through as its own bag, read only by SummaryStep.
export interface MemoryPhotoState {
  existingUrl?: string
  pendingFile?: File
  removed: boolean
  onPick: (file: File) => void
  onRemove: () => void
}

export interface StepProps {
  draft: PourDraft
  updateDraft: (patch: Partial<PourDraft>) => void
  bottle?: Bottle
  memoryPhoto?: MemoryPhotoState
}
