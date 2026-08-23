import { useEffect, useState } from 'react'
import { getPalateInterpretation, hashPalateProfile } from '../../data/repositories/palateInterpretation'
import type { PalateProfile } from './palateProfile'

export type PalateInterpretationState = 'loading' | 'ready' | 'none'

export interface UsePalateInterpretationResult {
  state: PalateInterpretationState
  interpretation: string | undefined
}

// Fetched once per meaningful profile change (via profileHash), not on
// every render or every minor pour edit — mirrors useFipGuide's shape.
export function usePalateInterpretation(uid: string | undefined, profile: PalateProfile): UsePalateInterpretationResult {
  const [state, setState] = useState<PalateInterpretationState>('loading')
  const [interpretation, setInterpretation] = useState<string | undefined>(undefined)
  const profileHash = hashPalateProfile(profile)

  useEffect(() => {
    if (!uid) {
      setState('none')
      return
    }
    let cancelled = false
    setState('loading')
    getPalateInterpretation(uid, profile)
      .then((result) => {
        if (cancelled) return
        setInterpretation(result)
        setState(result ? 'ready' : 'none')
      })
      .catch((err: unknown) => {
        console.error('[usePalateInterpretation] getPalateInterpretation failed', { uid, err })
        if (!cancelled) setState('none')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when the user or the profile's meaningful fields (profileHash) actually change
  }, [uid, profileHash])

  return { state, interpretation }
}
