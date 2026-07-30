import { Slider } from '../../../components/ui/Slider'
import { TapChip } from '../../../components/ui/TapChip'
import { Field, controlClassName } from '../../../components/ui/Field'
import { FIP_MAX, PALATE_FLAVORS } from '../../fip/scoring'
import type { StepProps } from './StepProps'
import styles from './steps.module.css'

export function PalateStep({ draft, updateDraft }: StepProps) {
  function toggleFlavor(flavor: string) {
    const has = draft.palateFlavors.includes(flavor)
    updateDraft({ palateFlavors: has ? draft.palateFlavors.filter((f) => f !== flavor) : [...draft.palateFlavors, flavor] })
  }

  return (
    <>
      <Slider id="pw-palate" label="Palate" max={FIP_MAX.palate} value={draft.palate} onChange={(palate) => updateDraft({ palate })} />

      <div className={styles.sectionLabel}>Flavors</div>
      <div className={styles.chipRow}>
        {PALATE_FLAVORS.map((flavor) => (
          <TapChip key={flavor} label={flavor} active={draft.palateFlavors.includes(flavor)} onToggle={() => toggleFlavor(flavor)} />
        ))}
      </div>

      <Field label="Palate notes" htmlFor="pw-palate-notes">
        <textarea
          id="pw-palate-notes"
          className={controlClassName}
          rows={3}
          value={draft.palateNotes ?? ''}
          onChange={(e) => updateDraft({ palateNotes: e.target.value })}
          placeholder="What do you taste?"
        />
      </Field>
    </>
  )
}
