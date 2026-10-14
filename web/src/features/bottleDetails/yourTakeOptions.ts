import type { BottleBuyAgain, WouldReplace } from '../../data/types'

// The bottle-level verdict choices, shared by the editable Your Take card
// and the read-only summary on the Overview tab.
export const BUY_AGAIN_OPTIONS: { value: BottleBuyAgain; label: string }[] = [
  { value: 'absolutely', label: 'Absolutely' },
  { value: 'at-msrp', label: 'At MSRP' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'probably-not', label: 'Probably Not' },
  { value: 'no', label: 'No' },
]

export const REPLACE_OPTIONS: { value: WouldReplace; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
]

export function buyAgainLabel(value: BottleBuyAgain | undefined): string | undefined {
  return BUY_AGAIN_OPTIONS.find((option) => option.value === value)?.label
}

export function replaceLabel(value: WouldReplace | undefined): string | undefined {
  return REPLACE_OPTIONS.find((option) => option.value === value)?.label
}
