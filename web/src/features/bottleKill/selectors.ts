import type { Bottle, Pour } from '../../data/types'
import { BUY_AGAIN_OPTIONS } from '../fip/scoring'
import { getCurrentScore, getPoursForBottle } from '../bottleDetails/selectors'

const DAY_MS = 24 * 60 * 60 * 1000

// Friendly, rounded — this is a celebratory summary, not a precise duration.
export function formatSpan(startIso: string, endIso: string): string {
  const days = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / DAY_MS))
  if (days === 0) return 'the same day'
  if (days === 1) return '1 day'
  if (days < 14) return `${days} days`
  if (days < 60) {
    const weeks = Math.max(1, Math.round(days / 7))
    return weeks === 1 ? '1 week' : `${weeks} weeks`
  }
  const months = Math.max(1, Math.round(days / 30.44))
  return months === 1 ? '1 month' : `${months} months`
}

export interface BottleKillSummary {
  pourCount: number
  spanText: string | undefined
  finalScore: number | undefined
  buyAgainLabel: string | undefined
}

// Deliberately takes `todayIso` rather than reading the clock itself — this
// runs the instant a bottle is marked finished, before that status change
// has necessarily landed in the bottle passed in, so it never depends on
// bottle.status. Every value here is either real data or omitted — nothing
// is invented to fill a gap (e.g. no pours logged means no final score, not
// a fabricated one).
export function buildBottleKillSummary(bottle: Bottle, pours: Pour[], todayIso: string): BottleKillSummary {
  const bottlePours = getPoursForBottle(pours, bottle.id) // sorted newest-first
  const latestBuyAgain = bottlePours[0]?.buyAgain
  const buyAgainLabel = latestBuyAgain ? BUY_AGAIN_OPTIONS.find((o) => o.value === latestBuyAgain)?.label : undefined

  return {
    pourCount: bottlePours.length,
    spanText: bottle.openedDate ? formatSpan(bottle.openedDate, todayIso) : undefined,
    finalScore: getCurrentScore(bottle, pours),
    buyAgainLabel,
  }
}
