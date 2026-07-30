import { Slider } from '../../../components/ui/Slider'
import { TapChip } from '../../../components/ui/TapChip'
import { Field, controlClassName } from '../../../components/ui/Field'
import { FIP_MAX, NOSE_AROMAS } from '../../fip/scoring'
import type { StepProps } from './StepProps'
import styles from './steps.module.css'

export function NoseStep({ draft, updateDraft }: StepProps) {
  function toggleAroma(aroma: string) {
    const has = draft.noseAromas.includes(aroma)
    updateDraft({ noseAromas: has ? draft.noseAromas.filter((a) => a !== aroma) : [...draft.noseAromas, aroma] })
  }

  return (
    <>
      <Slider id="pw-nose" label="Nose" max={FIP_MAX.nose} value={draft.nose} onChange={(nose) => updateDraft({ nose })} />

      <div className={styles.sectionLabel}>Aromas</div>
      <div className={styles.chipRow}>
        {NOSE_AROMAS.map((aroma) => (
          <TapChip key={aroma} label={aroma} active={draft.noseAromas.includes(aroma)} onToggle={() => toggleAroma(aroma)} />
        ))}
      </div>

      <Field label="Nose notes" htmlFor="pw-nose-notes">
        <textarea
          id="pw-nose-notes"
          className={controlClassName}
          rows={3}
          value={draft.noseNotes ?? ''}
          onChange={(e) => updateDraft({ noseNotes: e.target.value })}
          placeholder="What do you smell?"
        />
      </Field>
    </>
  )
}
