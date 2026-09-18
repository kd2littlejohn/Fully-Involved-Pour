import { Slider } from '../../../components/ui/Slider'
import { TapChip } from '../../../components/ui/TapChip'
import { Field, controlClassName } from '../../../components/ui/Field'
import { FIP_MAX } from '../../fip/scoring'
import { FINISH_DESCRIPTORS } from '../../flavorTaxonomy/taxonomy'
import type { StepProps } from './StepProps'
import styles from './steps.module.css'

export function FinishStep({ draft, updateDraft }: StepProps) {
  function toggleFinishTag(tag: string) {
    const has = draft.finishTags.includes(tag)
    updateDraft({ finishTags: has ? draft.finishTags.filter((t) => t !== tag) : [...draft.finishTags, tag] })
  }

  return (
    <>
      <Slider id="pw-finish" label="Finish" max={FIP_MAX.finish} value={draft.finish} onChange={(finish) => updateDraft({ finish })} />

      <div className={styles.sectionLabel}>Finish</div>
      <div className={styles.chipRow}>
        {FINISH_DESCRIPTORS.map((d) => (
          <TapChip key={d.label} label={d.label} active={draft.finishTags.includes(d.label)} onToggle={() => toggleFinishTag(d.label)} />
        ))}
      </div>

      <Field label="Finish notes" htmlFor="pw-finish-notes">
        <textarea
          id="pw-finish-notes"
          className={controlClassName}
          rows={3}
          value={draft.finishNotes ?? ''}
          onChange={(e) => updateDraft({ finishNotes: e.target.value })}
          placeholder="How long does it linger? What lingers?"
        />
      </Field>
    </>
  )
}
