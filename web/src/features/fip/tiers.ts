// FIP Rating tiers — FIP_PRODUCT_VISION_AND_DESIGN_SYSTEM.md §13.
export interface FipTier {
  label: string
  meaning: string
  color: string
}

const TIERS: readonly (FipTier & { min: number })[] = [
  { min: 9.5, label: 'Hall of Fame', meaning: 'Exceptional and unforgettable', color: 'var(--fip-success)' },
  { min: 9.0, label: 'Fully Involved', meaning: 'Outstanding and top shelf', color: 'var(--fip-amber)' },
  { min: 8.0, label: 'Working Fire', meaning: 'Excellent and worth buying again', color: 'var(--fip-amber)' },
  { min: 7.0, label: 'First Due', meaning: 'Good, dependable pour', color: 'var(--fip-brass)' },
  { min: 6.0, label: 'Routine Call', meaning: 'Average but enjoyable', color: 'var(--fip-muted)' },
  { min: -Infinity, label: 'False Alarm', meaning: 'Would not replace', color: 'var(--fip-error)' },
]

const FALLBACK_TIER: FipTier = { label: 'False Alarm', meaning: 'Would not replace', color: 'var(--fip-error)' }

export function fipTier(score: number): FipTier {
  return TIERS.find((t) => score >= t.min) ?? FALLBACK_TIER
}
