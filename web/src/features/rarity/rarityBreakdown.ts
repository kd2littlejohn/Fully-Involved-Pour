import type { Bottle, BottleRarity } from '../../data/types'
import { RARITY_OPTIONS, RARITY_LABEL, RARITY_COLOR, UNCLASSIFIED_LABEL, UNCLASSIFIED_COLOR } from './rarityLevels'
import { confirmedRarityOf, isOwnedForRarity } from './rarityFields'

export interface RarityBreakdownRow {
  key: BottleRarity | 'unclassified'
  label: string
  count: number
  percent: number
  color: string
}

export interface RarityBreakdown {
  rows: RarityBreakdownRow[]
  total: number
}

function bottleWeight(bottle: Bottle): number {
  return bottle.quantity ?? 1
}

// Physical-bottle count by confirmed rarity, owned bottles only (excludes
// Wishlist and Incoming — see isOwnedForRarity). A bottle counts toward a
// level only once it's genuinely confirmed — no rarity, a pending
// suggestion, and a declined suggestion all land in Unclassified. `total`
// is guarded to 0 up front so percent is never computed as 0/0 (NaN).
export function rarityBreakdown(bottles: Bottle[]): RarityBreakdown {
  const owned = bottles.filter(isOwnedForRarity)
  const counts: Record<BottleRarity | 'unclassified', number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    unicorn: 0,
    unclassified: 0,
  }

  let total = 0
  for (const bottle of owned) {
    const weight = bottleWeight(bottle)
    const rarity = confirmedRarityOf(bottle)
    counts[rarity ?? 'unclassified'] += weight
    total += weight
  }

  const percent = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100))

  const rows: RarityBreakdownRow[] = [
    ...RARITY_OPTIONS.map((o) => ({ key: o.value, label: RARITY_LABEL[o.value], count: counts[o.value], percent: percent(counts[o.value]), color: RARITY_COLOR[o.value] })),
    { key: 'unclassified' as const, label: UNCLASSIFIED_LABEL, count: counts.unclassified, percent: percent(counts.unclassified), color: UNCLASSIFIED_COLOR },
  ]

  return { rows, total }
}
