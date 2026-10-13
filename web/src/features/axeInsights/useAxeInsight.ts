import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bottle, Pour } from '../../data/types'
import { isMockAuthEnabled } from '../../data/devMode'
import { todayLocalIsoDate } from '../../data/localDate'
import {
  currentAxeExplanation,
  explainAxeInsight,
  isAxeInsightsSyncQueued,
  pendingAxeInsightsReason,
  readCachedAxeInsights,
  subscribeAxeInsights,
  syncAxeInsights,
  type AxeExplanationResult,
  type AxeInsightsView,
} from '../../data/repositories/axeInsights'
import { inputFingerprints, reconcileInsights, type InsightCategory } from './engine'

// Categories whose inputs the client can fingerprint from its own data
// (no blind results, no "today"). If these differ from what the cached
// insight was computed from, the cache is behind the user's data.
const CLIENT_CHECKABLE: InsightCategory[] = ['palate-evolution', 'flavor-discovery', 'collection-discovery']
// Time-based categories (rediscovery, milestones) move with the calendar;
// a cached insight older than this is re-checked once on Home.
const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000

export interface AxeInsightHookState {
  view: AxeInsightsView | null
  explanation: AxeExplanationResult | null
  // True only before anything (cache or server) is known.
  loading: boolean
  // 'updating': a refresh is under way. 'behind': the user's data has moved
  // on and no refresh is running (e.g. the service is unavailable), so the
  // card says when the insight is from instead of passing it off as fresh.
  freshness: 'current' | 'updating' | 'behind'
}

// Mock (dev preview) mode has no Cloud Functions: compute with the same
// engine locally so the card can be seen and tested.
function mockView(bottles: Bottle[], pours: Pour[]): AxeInsightsView {
  const { state } = reconcileInsights(null, { bottles, pours, today: todayLocalIsoDate() }, { now: Date.now(), sourceRevision: 'mock' })
  return {
    status: state.selected ? 'ready' : 'empty',
    generation: state.generation,
    inputFingerprints: state.inputFingerprints,
    calculatedAt: state.calculatedAt,
    selected: state.selected?.candidate ?? null,
    selectedFingerprint: state.selected?.fingerprint ?? null,
  }
}

function isBehind(view: AxeInsightsView | null, local: Record<InsightCategory, string>): boolean {
  if (!view?.inputFingerprints) return false
  return CLIENT_CHECKABLE.some((c) => view.inputFingerprints![c] !== local[c])
}

// The Home AXE Insight: renders immediately from the cached server view,
// re-checks with the server only when there's a reason to (no cache, a
// pending event, data the cache hasn't seen, or a stale time window), and
// upgrades the wording to AXE's validated explanation when one exists.
// Mounting, re-rendering and navigating never generate a new insight.
export function useAxeInsight(uid: string | undefined, bottles: Bottle[], pours: Pour[]): AxeInsightHookState {
  const mock = isMockAuthEnabled()
  const [view, setView] = useState<AxeInsightsView | null>(() => (uid && !mock ? readCachedAxeInsights(uid) : null))
  const [syncing, setSyncing] = useState(false)
  const [settled, setSettled] = useState(false)
  const [explanation, setExplanation] = useState<AxeExplanationResult | null>(null)
  const checkedFor = useRef<string | null>(null)

  const local = useMemo(() => inputFingerprints({ bottles, pours, today: '' }), [bottles, pours])
  const localKey = CLIENT_CHECKABLE.map((c) => local[c]).join('|')

  useEffect(() => {
    if (!uid) return
    if (mock) {
      setView(mockView(bottles, pours))
      setSettled(true)
      return
    }
    setView(readCachedAxeInsights(uid))
    return subscribeAxeInsights(uid, (next) => setView(next))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mock view follows the data below; real view follows the cache
  }, [uid, mock])

  useEffect(() => {
    if (mock && uid) setView(mockView(bottles, pours))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute only when the checkable inputs change
  }, [mock, uid, localKey])

  // Decide once per (user, data state) whether the server needs asking.
  useEffect(() => {
    if (!uid || mock) return
    const key = `${uid}|${localKey}`
    if (checkedFor.current === key) return
    checkedFor.current = key
    const cached = readCachedAxeInsights(uid)
    const pending = pendingAxeInsightsReason(uid)
    const stale = !cached?.calculatedAt || Date.now() - cached.calculatedAt > MAX_CACHE_AGE_MS
    const needs = !cached || pending !== null || isBehind(cached, local) || stale
    if (!needs) {
      setSettled(true)
      return
    }
    // A save already queued a request; its result arrives via subscribe.
    if (isAxeInsightsSyncQueued(uid)) return
    let cancelled = false
    setSyncing(true)
    void syncAxeInsights(uid, pending ?? 'home').then((next) => {
      if (cancelled) return
      if (next) setView(next)
      setSyncing(false)
      setSettled(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `local` is captured through localKey
  }, [uid, mock, localKey])

  // Wording: cached AI explanation or deterministic copy right away; ask
  // AXE at most once per insight (explainAxeInsight dedupes and caches).
  const fingerprint = view?.selectedFingerprint ?? null
  useEffect(() => {
    if (!uid || !view?.selected) {
      setExplanation(null)
      return
    }
    setExplanation(currentAxeExplanation(uid, view))
    if (mock) return
    let cancelled = false
    void explainAxeInsight(uid, view).then((result) => {
      if (!cancelled && result) setExplanation(result)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the insight's fingerprint, not the view object
  }, [uid, mock, fingerprint])

  return {
    view,
    explanation,
    loading: !view && !settled,
    freshness: syncing ? 'updating' : isBehind(view, local) ? (uid && isAxeInsightsSyncQueued(uid) ? 'updating' : 'behind') : 'current',
  }
}
