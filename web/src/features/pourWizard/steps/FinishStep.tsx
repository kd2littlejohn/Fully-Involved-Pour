import { Slider } from '../../../components/ui/Slider'
import { Field, controlClassName } from '../../../components/ui/Field'
import { FIP_MAX } from '../../fip/scoring'
import type { StepProps } from './StepProps'

export function FinishStep({ draft, updateDraft }: StepProps) {
  return (
    <>
      <Slider id="pw-finish" label="Finish" max={FIP_MAX.finish} value={draft.finish} onChange={(finish) => updateDraft({ finish })} />

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
