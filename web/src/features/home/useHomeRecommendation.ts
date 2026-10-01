import { useCallback, useEffect, useRef, useState } from 'react'
import { getRecommendation, type RecommendationResult } from '../whatShouldIPour/scoring'
import { explainPourRecommendation } from '../../data/repositories/pourRecommendationExplanation'
import type { Bottle, Pour } from '../../data/types'

export interface HomeRecommendationState {
  result: RecommendationResult | null
  shown: string[]
  explanation?: string
}

function recommendationKey(uid: string): string {
  return `fip-home-recommendation:${uid}`
}

function readPersisted(uid: string): HomeRecommendationState | null {
  try {
    const raw = localStorage.getItem(recommendationKey(uid))
    return raw ? (JSON.parse(raw) as HomeRecommendationState) : null
  } catch {
    return null
  }
}

function writePersisted(uid: string, value: HomeRecommendationState): void {
  try {
    localStorage.setItem(recommendationKey(uid), JSON.stringify(value))
  } catch {
    // Storage full or unavailable (private browsing) — best-effort.
  }
}

// Same pourable definition getRecommendation's own candidate pool already
// uses — open or sealed, and still actually present (not deleted).
function isStillAvailable(bottleId: string, bottles: Bottle[]): boolean {
  const bottle = bottles.find((b) => b.id === bottleId)
  return Boolean(bottle && (bottle.status === 'open' || bottle.status === 'sealed'))
}

function pickFresh(bottles: Bottle[], pours: Pour[], shown: string[] = []): HomeRecommendationState {
  const rec = getRecommendation(bottles, pours, 'surprise-me', shown) ?? null
  return { result: rec, shown: rec ? [...shown, rec.bottle.id] : shown }
}

// Persists the Home dashboard's "surprise me" pick per signed-in user —
// Home unmounts/remounts on every route change (router.tsx's <Outlet> has
// no keep-alive), so without this the card was re-rolling a brand-new pick
// on every visit instead of only when asked. Only three things are ever
// allowed to replace the persisted pick: the user explicitly asking for
// another (showAnother), the previously-picked bottle becoming unavailable,
// or there being nothing valid persisted yet (first run, or everything was
// wishlist/incoming last time) — never a background bottles/pours refetch
// or an unrelated screen's navigation.
export function useHomeRecommendation(uid: string | undefined, bottles: Bottle[], pours: Pour[]) {
  const [state, setState] = useState<HomeRecommendationState | undefined>(undefined)
  const stateRef = useRef(state)
  stateRef.current = state

  // Loads the persisted pick (or rolls a fresh one) once uid is known —
  // covers both the brief window before auth resolves and a same-tab
  // account switch. Deliberately keyed on uid alone: bottles/pours
  // changing while already loaded is handled by the effect below instead,
  // which only reacts to the one case that should regenerate anything.
  useEffect(() => {
    if (!uid) {
      setState(undefined)
      return
    }
    const persisted = readPersisted(uid)
    const reusable = persisted?.result && isStillAvailable(persisted.result.bottle.id, bottles) ? persisted : undefined
    const next = reusable ?? pickFresh(bottles, pours)
    if (!reusable) writePersisted(uid, next)
    setState(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on uid only; see comment above
  }, [uid])

  // Regenerates only when the currently-shown bottle itself has gone away
  // (deleted, finished, moved to wishlist/incoming) — any other bottles/
  // pours change is a no-op here, including a new bottle being added
  // elsewhere or an unrelated Firestore refetch.
  useEffect(() => {
    if (!uid) return
    const current = stateRef.current
    if (!current?.result) return
    if (isStillAvailable(current.result.bottle.id, bottles)) return
    const next = pickFresh(bottles, pours, current.shown)
    writePersisted(uid, next)
    setState(next)
  }, [uid, bottles, pours])

  // Fetches (and persists) the AI explanation once per genuinely new pick —
  // skipped on remount when one's already cached, so "preserve the
  // explanation" holds across navigation too, not just the bottle choice.
  useEffect(() => {
    const currentResult = state?.result
    if (!currentResult || state?.explanation !== undefined) return
    let cancelled = false
    explainPourRecommendation({
      bottleName: currentResult.bottle.name,
      distillery: currentResult.bottle.distillery,
      type: currentResult.bottle.type,
      moodLabel: 'tonight',
      reasons: currentResult.reasons,
      tags: currentResult.tags,
    })
      .then((text) => {
        if (cancelled || !text) return
        setState((prev) => {
          // Guards against a slow response landing after a newer pick
          // replaced it — belt-and-suspenders alongside `cancelled` below.
          if (!prev?.result || prev.result.bottle.id !== currentResult.bottle.id) return prev
          const next = { ...prev, explanation: text }
          if (uid) writePersisted(uid, next)
          return next
        })
      })
      .catch((err: unknown) => {
        console.error('[useHomeRecommendation] explainPourRecommendation failed', { bottleId: currentResult.bottle.id, err })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the bottle id, not the whole state object, so this only re-fires for a genuinely new pick
  }, [state?.result?.bottle.id, uid])

  const showAnother = useCallback(() => {
    if (!uid) return
    const next = pickFresh(bottles, pours, stateRef.current?.shown ?? [])
    writePersisted(uid, next)
    setState(next)
  }, [uid, bottles, pours])

  return {
    result: state?.result,
    explanation: state?.explanation,
    loaded: state !== undefined,
    showAnother,
  }
}
