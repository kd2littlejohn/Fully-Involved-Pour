import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import { todayLocalIsoDate } from '../localDate'
import type { InsightCandidate, InsightCategory } from '../../features/axeInsights/engine'

// Client side of AXE Insights (server: functions/axeInsights.js). The
// client never computes or sends statistics: it only says *that* something
// changed (and its own calendar date), then shows what the server stored.
//
// - Events: saves that touch pours or bottles (saveUserDoc) and blind
//   reveals call requestAxeInsightsSync. Calls are coalesced per user, so
//   one tasting submission (which can save more than once) is one request.
// - Recovery: a failed request leaves a pending marker; the next app load
//   retries it. Any later request recalculates from stored data anyway.
// - Cache: the last server view is kept in localStorage per user, so the
//   insight renders instantly and survives navigation and refresh.

export type AxeInsightsReason = 'data-changed' | 'blind-reveal' | 'home' | 'request-new' | 'recover'

export interface AxeInsightsView {
  status: 'ready' | 'empty'
  generation: number
  schemaVersion?: number
  sourceRevision?: string
  calculatedAt?: number
  inputFingerprints?: Record<InsightCategory, string>
  selected: InsightCandidate | null
  changed?: boolean
  stale?: boolean
  limited?: boolean
}

const CACHE_PREFIX = 'fip:axeInsights:'
const PENDING_PREFIX = 'fip:axeInsights:pending:'
export const SYNC_DEBOUNCE_MS = 2500

// Stronger reasons win when events coalesce: a blind reveal must re-read
// blind results even if a plain data change arrived in the same window.
const REASON_RANK: Record<AxeInsightsReason, number> = { home: 0, recover: 1, 'data-changed': 2, 'blind-reveal': 3, 'request-new': 4 }

export function readCachedAxeInsights(uid: string): AxeInsightsView | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + uid)
    return raw ? (JSON.parse(raw) as AxeInsightsView) : null
  } catch {
    return null
  }
}

// Only ever moves forward: an older generation never replaces a newer one,
// even if responses arrive out of order.
function writeCachedAxeInsights(uid: string, view: AxeInsightsView): void {
  try {
    const current = readCachedAxeInsights(uid)
    if (current && current.generation > view.generation) return
    localStorage.setItem(CACHE_PREFIX + uid, JSON.stringify(view))
  } catch {
    // Best-effort cache.
  }
}

export function pendingAxeInsightsReason(uid: string): AxeInsightsReason | null {
  try {
    return (localStorage.getItem(PENDING_PREFIX + uid) as AxeInsightsReason | null) ?? null
  } catch {
    return null
  }
}

function setPending(uid: string, reason: AxeInsightsReason | null): void {
  try {
    if (reason) localStorage.setItem(PENDING_PREFIX + uid, reason)
    else localStorage.removeItem(PENDING_PREFIX + uid)
  } catch {
    // Best-effort.
  }
}

const callable = () => httpsCallable<{ reason: AxeInsightsReason; today: string }, AxeInsightsView>(functions, 'syncAxeInsights')

// One immediate request. Resolves with the server's view (also cached), or
// with the cached view if the request fails, leaving a pending marker.
export async function syncAxeInsights(uid: string, reason: AxeInsightsReason): Promise<AxeInsightsView | null> {
  if (isMockAuthEnabled()) return readCachedAxeInsights(uid)
  try {
    const { data } = await callable()({ reason, today: todayLocalIsoDate() })
    writeCachedAxeInsights(uid, data)
    setPending(uid, null)
    return readCachedAxeInsights(uid)
  } catch (err) {
    console.error('syncAxeInsights failed', err)
    const pending = pendingAxeInsightsReason(uid)
    if (!pending || REASON_RANK[reason] > REASON_RANK[pending]) setPending(uid, reason === 'home' ? 'recover' : reason)
    return readCachedAxeInsights(uid)
  }
}

const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; reason: AxeInsightsReason }>()

// Fire-and-forget, coalesced: many events within SYNC_DEBOUNCE_MS become
// one request carrying the strongest reason. Marked pending immediately,
// so even a closed tab before the timer fires is retried on next load.
export function requestAxeInsightsSync(uid: string, reason: AxeInsightsReason): void {
  if (isMockAuthEnabled()) return
  const queued = timers.get(uid)
  const strongest = queued && REASON_RANK[queued.reason] > REASON_RANK[reason] ? queued.reason : reason
  if (queued) clearTimeout(queued.timer)
  const pending = pendingAxeInsightsReason(uid)
  if (!pending || REASON_RANK[strongest] > REASON_RANK[pending]) setPending(uid, strongest)
  const timer = setTimeout(() => {
    timers.delete(uid)
    void syncAxeInsights(uid, strongest)
  }, SYNC_DEBOUNCE_MS)
  timers.set(uid, { timer, reason: strongest })
}

// Retry whatever didn't make it last time (failed request, closed tab).
export function recoverPendingAxeInsightsSync(uid: string): void {
  const pending = pendingAxeInsightsReason(uid)
  if (pending && !timers.has(uid)) void syncAxeInsights(uid, pending)
}

const notifiedRooms = new Set<string>()

// A blind result became visible to this user (host revealed it, or a
// participant opened the reveal). Once per room per session: re-opening
// the same reveal adds nothing new.
export function notifyBlindRevealed(uid: string, roomId: string): void {
  const key = `${uid}:${roomId}`
  if (notifiedRooms.has(key)) return
  notifiedRooms.add(key)
  requestAxeInsightsSync(uid, 'blind-reveal')
}
