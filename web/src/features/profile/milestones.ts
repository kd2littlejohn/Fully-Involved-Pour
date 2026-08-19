import type { Bottle, BlindRoom, Pour } from '../../data/types'
import { fipTier } from '../fip/tiers'
import { getFinishedDate } from '../bottleDetails/selectors'

export interface ProfileMilestone {
  id: string
  label: string
  detail?: string
  date: string // ISO-ish, always real-comparable via string sort
}

const MAX_MILESTONES = 6
// Only the highest threshold actually reached is shown — checked
// highest-first so a 60-pour account gets "50 Pour Stories," not "10."
const POUR_MILESTONE_THRESHOLDS = [500, 250, 100, 50, 25, 10]

// Every entry here is a genuine event with a real date behind it — no
// fabricated achievements, and nothing without a reliable timestamp (e.g.
// Legacy Shelf has no "marked on" date in the schema, so it's deliberately
// left out rather than backdated to something invented). `completedBlinds`
// comes from the same fetch useBlindProfileStats already does for the
// Blind Profile card — reused here, not re-fetched.
export function getRecentMilestones(bottles: Bottle[], pours: Pour[], completedBlinds: { room: BlindRoom }[] = []): ProfileMilestone[] {
  const milestones: ProfileMilestone[] = []

  for (const bottle of bottles) {
    if (bottle.status !== 'finished') continue
    const finished = getFinishedDate(bottle, pours)
    if (!finished) continue
    milestones.push({ id: `kill-${bottle.id}`, label: 'Bottle Kill', detail: bottle.name, date: finished.date })
  }

  for (const pour of pours) {
    if (fipTier(pour.rating).label !== 'Hall of Fame') continue
    const bottleName = bottles.find((b) => b.id === pour.bottleId)?.name ?? 'a bottle'
    milestones.push({
      id: `hof-${pour.id}`,
      label: 'Hall of Fame Pour',
      detail: `${bottleName} — ${pour.rating.toFixed(1)}`,
      date: pour.date,
    })
  }

  const sortedPours = [...pours].sort((a, b) => a.date.localeCompare(b.date))
  const reachedThreshold = POUR_MILESTONE_THRESHOLDS.find((t) => sortedPours.length >= t)
  if (reachedThreshold) {
    const milestonePour = sortedPours[reachedThreshold - 1]
    if (milestonePour) {
      milestones.push({ id: `pours-${reachedThreshold}`, label: `${reachedThreshold} Pour Stories`, date: milestonePour.date })
    }
  }

  const sortedBlinds = [...completedBlinds].sort(
    (a, b) => (a.room.completedAt ?? a.room.revealedAt ?? 0) - (b.room.completedAt ?? b.room.revealedAt ?? 0),
  )
  const firstBlind = sortedBlinds[0]
  const firstBlindTs = firstBlind?.room.completedAt ?? firstBlind?.room.revealedAt
  if (firstBlind && firstBlindTs) {
    milestones.push({
      id: `first-blind-${firstBlind.room.id}`,
      label: 'First Blind Completed',
      detail: firstBlind.room.name,
      date: new Date(firstBlindTs).toISOString(),
    })
  }

  return milestones.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_MILESTONES)
}
