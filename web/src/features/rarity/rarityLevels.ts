import type { BottleRarity, RarityConfidence } from '../../data/types'

// Common -> Unicorn order — used for both the manual TapChip picker and the
// donut chart/legend, so the visual order is consistent everywhere.
export const RARITY_OPTIONS: { value: BottleRarity; label: string }[] = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'unicorn', label: 'Unicorn' },
]

export const RARITY_LABEL: Record<BottleRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  unicorn: 'Unicorn',
}

// One accent color per level, escalating from muted (Common) to bright
// (Unicorn) — used by RarityBadge and the donut chart/legend so both stay
// visually consistent with each other.
export const RARITY_COLOR: Record<BottleRarity, string> = {
  common: 'var(--fip-muted)',
  uncommon: 'var(--fip-cream-soft)',
  rare: 'var(--fip-copper)',
  unicorn: 'var(--fip-amber)',
}

export const UNCLASSIFIED_LABEL = 'Unclassified'
export const UNCLASSIFIED_COLOR = 'var(--fip-border-subtle)'

export const CONFIDENCE_LABEL: Record<RarityConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}
