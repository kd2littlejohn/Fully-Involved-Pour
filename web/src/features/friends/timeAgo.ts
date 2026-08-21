const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

// Compact "2h ago" / "3d ago" style, matching the density of the Friends
// screens (activity rows, preview cards) — full dates would be too long for
// a horizontal card or a one-line activity row.
export function timeAgo(createdAt: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - createdAt)
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`
  return `${Math.floor(diff / WEEK)}w ago`
}
