import type { BlindComparisonReason } from '../../data/types'

export interface ComparisonReasonOption {
  value: BlindComparisonReason
  label: string
}

export const COMPARISON_REASONS: ComparisonReasonOption[] = [
  { value: 'better-smell', label: 'Better Smell' },
  { value: 'better-flavor', label: 'Better Flavor' },
  { value: 'better-finish', label: 'Better Finish' },
  { value: 'less-heat', label: 'Less Heat' },
  { value: 'more-flavor', label: 'More Flavor' },
  { value: 'better-balance', label: 'Better Balance' },
  { value: 'simply-enjoyed-more', label: 'I Simply Enjoyed It More' },
]
