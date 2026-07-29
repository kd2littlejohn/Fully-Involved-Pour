import type { Bottle, Pour } from '../../data/types'

export function getFeaturedOpenBottle(bottles: Bottle[]): Bottle | undefined {
  return [...bottles]
    .filter((b) => b.status === 'open')
    .sort((a, b) => (b.openedDate ?? '').localeCompare(a.openedDate ?? ''))[0]
}

export function getRecentBottles(bottles: Bottle[], limit = 4): Bottle[] {
  return [...bottles].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, limit)
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
