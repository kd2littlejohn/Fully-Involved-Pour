import type { Bottle, Pour } from '../../data/types'

const DAY_MS = 24 * 60 * 60 * 1000
const STALE_POUR_DAYS = 14

// Bottles the user already owns but hasn't gotten to lately: every sealed
// bottle (never opened) plus any open bottle that's gone quiet — opened but
// never poured, or not poured in a while. Deliberately excludes `incoming`
// (not yet arrived — that's the separate Coming Soon section) and
// `finished`/`wishlist` (nothing to pour). Oldest additions surface first,
// since those are the ones that have been waiting longest.
export function getMaybeTonightBottles(bottles: Bottle[], pours: Pour[], limit = 4): Bottle[] {
  const lastPourDateByBottle = new Map<string, string>()
  for (const pour of pours) {
    const existing = lastPourDateByBottle.get(pour.bottleId)
    if (!existing || pour.date > existing) lastPourDateByBottle.set(pour.bottleId, pour.date)
  }

  const now = Date.now()
  const candidates = bottles.filter((bottle) => {
    if (bottle.status === 'sealed') return true
    if (bottle.status !== 'open') return false
    const lastPourDate = lastPourDateByBottle.get(bottle.id)
    if (!lastPourDate) return true
    const daysSincePour = (now - new Date(lastPourDate).getTime()) / DAY_MS
    return daysSincePour >= STALE_POUR_DAYS
  })

  return [...candidates].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)).slice(0, limit)
}

export function getFeaturedOpenBottle(bottles: Bottle[]): Bottle | undefined {
  return [...bottles]
    .filter((b) => b.status === 'open')
    .sort((a, b) => (b.openedDate ?? '').localeCompare(a.openedDate ?? ''))[0]
}

export function getRecentBottles(bottles: Bottle[], limit = 4): Bottle[] {
  return [...bottles].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, limit)
}

export function getIncomingBottles(bottles: Bottle[]): Bottle[] {
  return [...bottles]
    .filter((b) => b.status === 'incoming')
    .sort((a, b) => (a.expectedDate ?? '').localeCompare(b.expectedDate ?? ''))
}

export function getRecentPours(pours: Pour[], limit = 4): Pour[] {
  return [...pours].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
