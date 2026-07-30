import { useCallback, useEffect, useState } from 'react'
import { blankDraft, type PourDraft } from '../features/pourWizard/draft'

function draftKey(bottleId: string): string {
  return `fip-pour-draft:${bottleId}`
}

function readDraft(bottleId: string): PourDraft {
  try {
    const raw = localStorage.getItem(draftKey(bottleId))
    if (!raw) return blankDraft()
    return { ...blankDraft(), ...(JSON.parse(raw) as Partial<PourDraft>) }
  } catch {
    return blankDraft()
  }
}

export function usePourDraft(bottleId: string) {
  const [draft, setDraft] = useState<PourDraft>(() => readDraft(bottleId))

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(bottleId), JSON.stringify(draft))
    } catch {
      // Storage full or unavailable — draft persistence is best-effort.
    }
  }, [bottleId, draft])

  const updateDraft = useCallback((patch: Partial<PourDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey(bottleId))
    } catch {
      // ignore
    }
    setDraft(blankDraft())
  }, [bottleId])

  return { draft, updateDraft, clearDraft }
}
