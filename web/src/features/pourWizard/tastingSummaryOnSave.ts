import { generateTastingSummary, hashTastingInput } from '../../data/repositories/tastingSummary'
import type { Pour, PourAiSummary } from '../../data/types'

// Fires after a pour is already safely saved (see PourWizard.tsx) — never
// awaited from the save flow, so an AI failure or slow response has zero
// effect on the save itself. Regenerates only when the tasting-relevant
// fields actually changed (via sourceHash), never on every edit.
export async function generateAndSaveTastingSummary(
  pour: Pour,
  updatePourAiSummary: (pourId: string, aiSummary: PourAiSummary) => Promise<void>,
): Promise<void> {
  const sourceHash = hashTastingInput({
    noseAromas: pour.fip.noseAromas,
    noseNotes: pour.fip.noseNotes,
    palateFlavors: pour.fip.palateFlavors,
    palateNotes: pour.fip.palateNotes,
    finishNotes: pour.fip.finishNotes,
    rating: pour.rating,
  })
  if (pour.aiSummary?.sourceHash === sourceHash) return

  try {
    const summary = await generateTastingSummary({
      noseAromas: pour.fip.noseAromas,
      noseNotes: pour.fip.noseNotes,
      palateFlavors: pour.fip.palateFlavors,
      palateNotes: pour.fip.palateNotes,
      finishNotes: pour.fip.finishNotes,
      rating: pour.rating,
    })
    if (!summary) return
    await updatePourAiSummary(pour.id, { text: summary, sourceHash, generatedAt: Date.now() })
  } catch (err) {
    console.error('[tastingSummaryOnSave] generateAndSaveTastingSummary failed', { pourId: pour.id, err })
  }
}
