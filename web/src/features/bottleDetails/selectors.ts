import type { Bottle, Pour } from '../../data/types'

export function mashBillSummary(bottle: Bottle): string | undefined {
  const parts: string[] = []
  if (bottle.mashBillCorn) parts.push(`${bottle.mashBillCorn}% Corn`)
  if (bottle.mashBillRyeWheat) parts.push(`${bottle.mashBillRyeWheat}% Rye/Wheat`)
  if (bottle.mashBillMalted) parts.push(`${bottle.mashBillMalted}% Malted Barley`)
  return parts.length > 0 ? parts.join(' / ') : undefined
}

export function getPoursForBottle(pours: Pour[], bottleId: string): Pour[] {
  return pours.filter((p) => p.bottleId === bottleId).sort((a, b) => b.date.localeCompare(a.date))
}

export function getCurrentScore(bottle: Bottle, pours: Pour[]): number | undefined {
  const bottlePours = getPoursForBottle(pours, bottle.id)
  const latest = bottlePours[0]
  if (latest) return latest.rating
  return bottle.rating
}

export interface JourneyEvent {
  id: string
  date: string
  label: string
  detail?: string
  pourId?: string
  bottleId?: string
}

// Built only from real fields the user entered — never fabricated. See
// FIP_PRODUCT_VISION_AND_DESIGN_SYSTEM.md §9 and project memory on the
// Journey tab ("no fabricated events").
export function buildJourneyEvents(bottle: Bottle, pours: Pour[]): JourneyEvent[] {
  const events: JourneyEvent[] = []

  if (bottle.createdAt) {
    events.push({ id: 'added', date: new Date(bottle.createdAt).toISOString(), label: 'Added to collection' })
  }

  if (bottle.openedDate) {
    events.push({ id: 'opened', date: bottle.openedDate, label: 'Opened' })
  }

  for (const pour of getPoursForBottle(pours, bottle.id)) {
    events.push({
      id: `pour-${pour.id}`,
      date: pour.date,
      label: `Pour Story — ${pour.rating.toFixed(1)}`,
      detail: pour.occasion,
      pourId: pour.id,
      bottleId: bottle.id,
    })
  }

  if (bottle.status === 'finished') {
    events.push({ id: 'kill', date: bottle.openedDate ?? new Date(bottle.createdAt ?? Date.now()).toISOString(), label: 'Bottle Kill' })
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}
