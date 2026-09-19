import { Slider } from '../../../components/ui/Slider'
import { Field, controlClassName } from '../../../components/ui/Field'
import { BUY_AGAIN_OPTIONS, FIP_MAX } from '../../fip/scoring'
import type { BuyAgain } from '../../../data/types'
import type { StepProps } from './StepProps'

// Meaningful checkpoints along the slider, not a running commentary on every
// tick — a rater new to "complexity & balance" as one combined score needs
// to know roughly where they land, not a precise formula.
function describeComplexity(value: number, max: number): string {
  const pct = max > 0 ? value / max : 0
  if (pct >= 0.85) return 'Exceptional — many distinct layers that evolve together with no rough edges.'
  if (pct >= 0.6) return 'Layered and balanced — flavors develop without any one note taking over.'
  if (pct >= 0.35) return 'Some development, but fairly straightforward or a little unbalanced.'
  return 'Simple or one-note — or noticeably out of balance.'
}

export function ComplexityStep({ draft, updateDraft }: StepProps) {
  return (
    <>
      <Slider
        id="pw-complexity"
        label="Complexity & Balance"
        max={FIP_MAX.complexity}
        step={0.05}
        value={draft.complexity}
        onChange={(complexity) => updateDraft({ complexity })}
        describeValue={describeComplexity}
      />

      <Field label="Would you buy it again?" htmlFor="pw-buy-again">
        <select
          id="pw-buy-again"
          className={controlClassName}
          value={draft.buyAgain ?? ''}
          onChange={(e) => updateDraft({ buyAgain: (e.target.value || undefined) as BuyAgain | undefined })}
        >
          <option value="">Choose one…</option>
          {BUY_AGAIN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes" htmlFor="pw-complexity-notes">
        <textarea
          id="pw-complexity-notes"
          className={controlClassName}
          rows={3}
          value={draft.complexityNotes ?? ''}
          onChange={(e) => updateDraft({ complexityNotes: e.target.value })}
          placeholder="How balanced and layered was this pour?"
        />
      </Field>
    </>
  )
}
