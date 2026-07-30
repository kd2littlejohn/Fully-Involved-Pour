import type { Bottle } from '../../data/types'

export interface JourneyStage {
  label: string
  color: string
}

const DAY_MS = 24 * 60 * 60 * 1000

// Derived from existing fields (status/openedDate) only — no schema change.
// Loosely follows the bottle-evolution stages in FIP_PRODUCT_VISION_AND_DESIGN_SYSTEM.md §9.
export function bottleJourneyStage(bottle: Bottle): JourneyStage | undefined {
  if (bottle.status === 'finished') {
    return { label: 'Bottle Kill', color: 'var(--fip-stone)' }
  }

  if (bottle.status !== 'open') return undefined

  if (!bottle.openedDate) {
    return { label: 'New', color: 'var(--fip-success)' }
  }

  const daysOpen = (Date.now() - new Date(bottle.openedDate).getTime()) / DAY_MS

  if (daysOpen < 7) return { label: 'New', color: 'var(--fip-success)' }
  if (daysOpen < 30) return { label: 'Opening Up', color: 'var(--fip-warning)' }
  return { label: 'Peak', color: 'var(--fip-copper)' }
}
