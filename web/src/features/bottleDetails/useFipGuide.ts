import { useEffect, useState } from 'react'
import type { Bottle } from '../../data/types'
import { getFipGuide, type FipGuide } from '../../data/repositories/fipGuide'

export type FipGuideLoadState = 'loading' | 'ready' | 'none'

export interface UseFipGuideResult {
  state: FipGuideLoadState
  guide: FipGuide | undefined
}

// Fetched once per bottle identity (not on every ownership-field edit) and
// shared by every Overview UI that needs it — FipGuideSection (the FIP
// Guide + Typical Profile cards) and Bottle Info's Availability row both
// read from this same call instead of each fetching their own copy.
export function useFipGuide(bottle: Bottle): UseFipGuideResult {
  const [state, setState] = useState<FipGuideLoadState>('loading')
  const [guide, setGuide] = useState<FipGuide | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    getFipGuide(bottle)
      .then((result) => {
        if (cancelled) return
        setGuide(result)
        setState(result ? 'ready' : 'none')
      })
      .catch((err: unknown) => {
        console.error('[useFipGuide] getFipGuide failed', { bottleId: bottle.id, err })
        if (!cancelled) setState('none')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when the bottle actually identifies a different product, not on every ownership-field edit
  }, [bottle.id, bottle.name, bottle.distillery])

  return { state, guide }
}
