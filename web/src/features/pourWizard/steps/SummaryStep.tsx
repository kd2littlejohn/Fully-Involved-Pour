import { ScoreRing } from '../../../components/ui/ScoreRing'
import { SpecList, type SpecRow } from '../../../components/ui/SpecList'
import { Field, controlClassName } from '../../../components/ui/Field'
import { FIP_MAX, buyAgainToValueScore, computeFipTotal } from '../../fip/scoring'
import { fipTier } from '../../fip/tiers'
import type { StepProps } from './StepProps'
import styles from './SummaryStep.module.css'

export function SummaryStep({ draft, updateDraft }: StepProps) {
  const value = buyAgainToValueScore(draft.buyAgain)
  const total = computeFipTotal({ nose: draft.nose, palate: draft.palate, finish: draft.finish, complexity: draft.complexity, value })
  const tier = fipTier(total)

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
    </>
  )
}
