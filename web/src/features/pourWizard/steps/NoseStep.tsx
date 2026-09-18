import { Slider } from '../../../components/ui/Slider'
import { FlavorFamilySelector } from '../../../components/domain/FlavorFamilySelector'
import { Field, controlClassName } from '../../../components/ui/Field'
import { FIP_MAX } from '../../fip/scoring'
import { FLAVOR_DESCRIPTORS } from '../../flavorTaxonomy/taxonomy'
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
      <FlavorFamilySelector descriptors={FLAVOR_DESCRIPTORS} selected={draft.noseAromas} onToggle={toggleAroma} />

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
