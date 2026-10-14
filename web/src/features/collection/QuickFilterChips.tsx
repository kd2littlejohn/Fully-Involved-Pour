import type { Filter } from './collectionFilters'
import type { RarityFilterValue } from '../rarity/rarityFilter'
import styles from './QuickFilterChips.module.css'

interface QuickFilterChipsProps {
  filter: Filter
  rarity: RarityFilterValue
  onFilterChange: (filter: Filter) => void
  onRarityChange: (rarity: RarityFilterValue) => void
}

type Chip =
  | { key: string; label: string; kind: 'all' }
  | { key: string; label: string; kind: 'status'; value: Filter }
  | { key: string; label: string; kind: 'rarity'; value: Exclude<RarityFilterValue, null> }

const CHIPS: Chip[] = [
  { key: 'all', label: 'All', kind: 'all' },
  { key: 'open', label: 'Open', kind: 'status', value: 'open' },
  { key: 'sealed', label: 'Sealed', kind: 'status', value: 'sealed' },
  { key: 'rare', label: 'Rare', kind: 'rarity', value: 'rare' },
  { key: 'uncommon', label: 'Uncommon', kind: 'rarity', value: 'uncommon' },
]

// Shortcuts onto My Bar's two existing filter dimensions, nothing new:
// Open/Sealed set the status filter, Rare/Uncommon the rarity filter, so
// they combine exactly as the summary tiles and the rarity chart already
// do (e.g. Sealed + Rare). Tapping an active chip clears it; All clears
// both.
export function QuickFilterChips({ filter, rarity, onFilterChange, onRarityChange }: QuickFilterChipsProps) {
  function isActive(chip: Chip): boolean {
    if (chip.kind === 'all') return filter === 'all' && rarity === null
    if (chip.kind === 'status') return filter === chip.value
    return rarity === chip.value
  }

  function handleClick(chip: Chip) {
    if (chip.kind === 'all') {
      onFilterChange('all')
      onRarityChange(null)
    } else if (chip.kind === 'status') {
      onFilterChange(filter === chip.value ? 'all' : chip.value)
    } else {
      onRarityChange(rarity === chip.value ? null : chip.value)
    }
  }

  return (
    <div className={styles.row} role="group" aria-label="Quick filters">
      {CHIPS.map((chip) => {
        const active = isActive(chip)
        return (
          <button
            key={chip.key}
            type="button"
            className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            aria-pressed={active}
            onClick={() => handleClick(chip)}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
