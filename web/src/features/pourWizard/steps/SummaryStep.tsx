import { useState } from 'react'
import { ScoreRing } from '../../../components/ui/ScoreRing'
import { SpecList, type SpecRow } from '../../../components/ui/SpecList'
import { Field, controlClassName } from '../../../components/ui/Field'
import { Button } from '../../../components/ui/Button'
import { FIP_MAX, buyAgainToValueScore, computeFipTotal } from '../../fip/scoring'
import { fipTier } from '../../fip/tiers'
import { generateTastingProfile } from '../../../data/repositories/ai'
import { MemoryPhotoField } from '../MemoryPhotoField'
import type { StepProps } from './StepProps'
import styles from './SummaryStep.module.css'

export function SummaryStep({ draft, updateDraft, bottle, memoryPhoto }: StepProps) {
  const value = buyAgainToValueScore(draft.buyAgain)
  const total = computeFipTotal({ nose: draft.nose, palate: draft.palate, finish: draft.finish, complexity: draft.complexity, value })
  const tier = fipTier(total)
  const [generating, setGenerating] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  async function handleGenerateTastingNote() {
    if (generating) return
    setGenerating(true)
    setAiStatus('Asking the sommelier…')
    try {
      const profile = await generateTastingProfile({
        bottleName: bottle?.name ?? 'this bottle',
        distillery: bottle?.distillery,
        type: bottle?.type,
        proof: bottle?.proof,
        flavors: draft.palateFlavors,
      })
      updateDraft({
        noseNotes: draft.noseNotes?.trim() ? draft.noseNotes : profile.nose,
        palateNotes: draft.palateNotes?.trim() ? draft.palateNotes : profile.palate,
        finishNotes: draft.finishNotes?.trim() ? draft.finishNotes : profile.finish,
        palateFlavors: Array.from(new Set([...draft.palateFlavors, ...profile.flavors])),
      })
      setAiStatus('✨ AI tasting note added to Nose, Palate, and Finish.')
    } catch {
      setAiStatus("The sommelier couldn't generate a note just now. Try again in a moment.")
    } finally {
      setGenerating(false)
    }
  }

  const rows: SpecRow[] = [
    { label: 'Nose', value: `${draft.nose.toFixed(1)} / ${FIP_MAX.nose}` },
    { label: 'Palate', value: `${draft.palate.toFixed(1)} / ${FIP_MAX.palate}` },
    { label: 'Finish', value: `${draft.finish.toFixed(1)} / ${FIP_MAX.finish}` },
    { label: 'Complexity & Balance', value: `${draft.complexity.toFixed(1)} / ${FIP_MAX.complexity}` },
    { label: 'Value / Buy Again', value: `${value.toFixed(1)} / ${FIP_MAX.value}` },
  ]

  return (
    <>
      <div className={styles.header}>
        <ScoreRing score={total} />
        <div className={styles.headerText}>
          <div className={styles.tierLabel}>{tier.label}</div>
          <div className={styles.tierMeaning}>{tier.meaning}</div>
        </div>
      </div>

      <SpecList rows={rows} />

      <div className={styles.aiRow}>
        <Button type="button" variant="ghost" onClick={handleGenerateTastingNote} disabled={generating}>
          {generating ? 'Asking the sommelier…' : '✨ AI Tasting Note'}
        </Button>
      </div>
      {aiStatus ? <p className={styles.aiStatus}>{aiStatus}</p> : null}

      <div className={styles.checkboxRow}>
        <input
          id="pw-would-buy-again"
          type="checkbox"
          checked={draft.wouldBuyAgain ?? false}
          onChange={(e) => updateDraft({ wouldBuyAgain: e.target.checked })}
        />
        <label htmlFor="pw-would-buy-again">I'd buy this again</label>
      </div>

      <Field label="The memory" htmlFor="pw-memory">
        <textarea
          id="pw-memory"
          className={controlClassName}
          rows={4}
          value={draft.memory ?? ''}
          onChange={(e) => updateDraft({ memory: e.target.value })}
          placeholder="What made this pour worth remembering?"
        />
      </Field>

      {memoryPhoto ? <MemoryPhotoField {...memoryPhoto} /> : null}
    </>
  )
}
