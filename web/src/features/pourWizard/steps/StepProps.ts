import type { Bottle } from '../../../data/types'
import type { PourDraft } from '../draft'

export interface StepProps {
  draft: PourDraft
  updateDraft: (patch: Partial<PourDraft>) => void
  bottle?: Bottle
}
