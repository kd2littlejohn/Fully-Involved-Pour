import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import { todayLocalIsoDate } from '../localDate'
import {
  deterministicExplanation,
  EXPLANATION_VERSION,
  type InsightCandidate,
  type InsightCategory,
  type InsightExplanation,
} from '../../features/axeInsights/engine'

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
  selectedFingerprint?: string | null
  changed?: boolean
  stale?: boolean
  limited?: boolean
}

const CACHE_PREFIX = 'fip:axeInsights:'
const PENDING_PREFIX = 'fip:axeInsights:pending:'
const BACKOFF_PREFIX = 'fip:axeInsights:backoff:'
export const SYNC_DEBOUNCE_MS = 2500

// If the function is unavailable (not deployed yet, outage, offline), the
// app keeps working from its cached insight and stops calling for a while:
// 1 min, 5 min, 30 min, 2 h, then every 6 h, reset by the next success.
// The event stays pending, so nothing is lost while backing off.
export const BACKOFF_STEPS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000]

interface Backoff {
  failures: number
  until: number
}

function readBackoff(uid: string): Backoff | null {
  try {
    const raw = localStorage.getItem(BACKOFF_PREFIX + uid)
    return raw ? (JSON.parse(raw) as Backoff) : null
  } catch {
    return null
  }
}

function writeBackoff(uid: string, backoff: Backoff | null): void {
  try {
    if (backoff) localStorage.setItem(BACKOFF_PREFIX + uid, JSON.stringify(backoff))
    else localStorage.removeItem(BACKOFF_PREFIX + uid)
  } catch {
    // Best-effort.
  }
}

export function isAxeInsightsBackingOff(uid: string, now = Date.now()): boolean {
  const backoff = readBackoff(uid)
  return Boolean(backoff && now < backoff.until)
}

function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

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

const callable = () =>
  httpsCallable<{ reason: AxeInsightsReason; today: string; timeZone?: string }, AxeInsightsView>(functions, 'syncAxeInsights')

// One request. Resolves with the server's view (also cached). On failure,
// or while backing off after one, resolves with the cached view instead
// and leaves the event pending: the UI never breaks on this call.
export async function syncAxeInsights(uid: string, reason: AxeInsightsReason): Promise<AxeInsightsView | null> {
  if (isMockAuthEnabled()) return readCachedAxeInsights(uid)
  if (isAxeInsightsBackingOff(uid)) {
    rememberPending(uid, reason)
    return readCachedAxeInsights(uid)
  }
  try {
    const { data } = await callable()({ reason, today: todayLocalIsoDate(), timeZone: localTimeZone() })
    writeCachedAxeInsights(uid, data)
    setPending(uid, null)
    writeBackoff(uid, null)
    return readCachedAxeInsights(uid)
  } catch (err) {
    const failures = (readBackoff(uid)?.failures ?? 0) + 1
    const delay = BACKOFF_STEPS_MS[Math.min(failures, BACKOFF_STEPS_MS.length) - 1]!
    writeBackoff(uid, { failures, until: Date.now() + delay })
    // One quiet line per failure window, not an error per save.
    console.warn(`AXE insights unavailable; retrying in ${Math.round(delay / 60_000)} min`, err)
    rememberPending(uid, reason)
    return readCachedAxeInsights(uid)
  }
}

function rememberPending(uid: string, reason: AxeInsightsReason): void {
  const asPending = reason === 'home' ? 'recover' : reason
  const pending = pendingAxeInsightsReason(uid)
  if (!pending || REASON_RANK[asPending] > REASON_RANK[pending]) setPending(uid, asPending)
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
  if (pending && !timers.has(uid) && !isAxeInsightsBackingOff(uid)) void syncAxeInsights(uid, pending)
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

// ---------------------------------------------------------------------------
// AXE explanations (askSommelier { mode: 'explain-insight' }). The server
// validates and caches them per insight fingerprint; this keeps a local copy
// per fingerprint so Home never asks again on navigation or refresh. Until
// (or unless) one exists, the engine's deterministic copy is shown: the
// card never depends on the model.
// ---------------------------------------------------------------------------

export interface AxeExplanationResult {
  explanation: InsightExplanation
  source: 'ai' | 'deterministic'
}

interface CachedExplanation {
  fingerprint: string
  version: number
  explanation: InsightExplanation
}

const EXPLANATION_PREFIX = 'fip:axeInsights:explanation:'
const attemptedThisSession = new Set<string>()
const inFlight = new Map<string, Promise<AxeExplanationResult>>()

function readCachedExplanation(uid: string, fingerprint: string): InsightExplanation | null {
  try {
    const raw = localStorage.getItem(EXPLANATION_PREFIX + uid)
    const cached = raw ? (JSON.parse(raw) as CachedExplanation) : null
    return cached && cached.fingerprint === fingerprint && cached.version === EXPLANATION_VERSION ? cached.explanation : null
  } catch {
    return null
  }
}

function writeCachedExplanation(uid: string, fingerprint: string, explanation: InsightExplanation): void {
  try {
    const entry: CachedExplanation = { fingerprint, version: EXPLANATION_VERSION, explanation }
    localStorage.setItem(EXPLANATION_PREFIX + uid, JSON.stringify(entry))
  } catch {
    // Best-effort.
  }
}

// Synchronous: what to show right now (cached AI wording, else deterministic).
export function currentAxeExplanation(uid: string, view: AxeInsightsView): AxeExplanationResult | null {
  if (!view.selected) return null
  const cached = view.selectedFingerprint ? readCachedExplanation(uid, view.selectedFingerprint) : null
  return cached ? { explanation: cached, source: 'ai' } : { explanation: deterministicExplanation(view.selected), source: 'deterministic' }
}

const explainCallable = () =>
  httpsCallable<
    { mode: 'explain-insight' },
    { status: string; source: 'ai' | 'deterministic' | 'none'; fingerprint: string | null; explanation: InsightExplanation | null }
  >(functions, 'askSommelier')

// Asks AXE for wording at most once per insight per session, and never for
// an insight that already has a cached explanation.
export function explainAxeInsight(uid: string, view: AxeInsightsView): Promise<AxeExplanationResult | null> {
  const fallback = currentAxeExplanation(uid, view)
  const fingerprint = view.selectedFingerprint
  if (!fallback || !fingerprint || fallback.source === 'ai' || isMockAuthEnabled()) return Promise.resolve(fallback)
  const key = `${uid}:${fingerprint}`
  const running = inFlight.get(key)
  if (running) return running
  if (attemptedThisSession.has(key)) return Promise.resolve(fallback)
  attemptedThisSession.add(key)

  const request = explainCallable()({ mode: 'explain-insight' })
    .then(({ data }) => {
      // Only keep wording for the insight we asked about, and only AI
      // wording ("pending"/"budget"/"fallback" may succeed another day).
      if (data.source === 'ai' && data.explanation && data.fingerprint === fingerprint) {
        writeCachedExplanation(uid, fingerprint, data.explanation)
        return { explanation: data.explanation, source: 'ai' as const }
      }
      return fallback
    })
    .catch((err) => {
      console.warn('AXE explanation unavailable; showing the standard wording', err)
      return fallback
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, request)
  return request
}
