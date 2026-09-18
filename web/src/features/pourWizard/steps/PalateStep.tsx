import { Slider } from '../../../components/ui/Slider'
import { FlavorFamilySelector } from '../../../components/domain/FlavorFamilySelector'
import { Field, controlClassName } from '../../../components/ui/Field'
import { FIP_MAX } from '../../fip/scoring'
import { FLAVOR_DESCRIPTORS } from '../../flavorTaxonomy/taxonomy'
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
      <FlavorFamilySelector descriptors={FLAVOR_DESCRIPTORS} selected={draft.palateFlavors} onToggle={toggleFlavor} />

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
