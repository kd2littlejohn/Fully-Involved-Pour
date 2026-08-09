import type { Bottle, Pour } from '../../data/types'
import type { TimelineEvent } from '../../components/domain/Timeline'

export function getJournalTimeline(bottles: Bottle[], pours: Pour[]): TimelineEvent[] {
  const bottleNameById = new Map(bottles.map((b) => [b.id, b.name]))

  return [...pours]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((pour) => ({
      id: pour.id,
      date: pour.date,
      label: `${bottleNameById.get(pour.bottleId) ?? 'Unknown bottle'} — ${pour.rating.toFixed(1)}`,
      detail: pour.occasion,
      pourId: pour.id,
      bottleId: pour.bottleId,
    }))
}

export interface CompanionStat {
  name: string
  pourCount: number
  bottleIds: string[]
}

// Derived entirely from the existing pour.companion field — no schema
// change. A dedicated People/companion data model is a separate,
// explicitly-approved future step (see FIP_PRODUCT_VISION_AND_DESIGN_SYSTEM.md §11).
export function getCompanionStats(pours: Pour[]): CompanionStat[] {
  const byName = new Map<string, { pourCount: number; bottleIds: Set<string> }>()

  for (const pour of pours) {
    const name = pour.companion?.trim()
    if (!name) continue
    const existing = byName.get(name) ?? { pourCount: 0, bottleIds: new Set<string>() }
    existing.pourCount += 1
    existing.bottleIds.add(pour.bottleId)
    byName.set(name, existing)
  }

  return [...byName.entries()]
    .map(([name, stat]) => ({ name, pourCount: stat.pourCount, bottleIds: [...stat.bottleIds] }))
    .sort((a, b) => b.pourCount - a.pourCount)
}

export function getBottleJourneys(bottles: Bottle[]): Bottle[] {
  return bottles.filter((b) => b.status === 'open' || b.status === 'finished')
}
