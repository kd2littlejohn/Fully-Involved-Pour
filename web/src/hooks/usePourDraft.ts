import { useCallback, useEffect, useState } from 'react'
import { blankDraft, type PourDraft } from '../features/pourWizard/draft'
import { useAuth } from './useAuth'

// uid-scoped, matching every other per-user cache key in the app (see
// data/localCache.ts, data/hiddenBlindRooms.ts) — a bare bottleId key would
// let one account's in-progress draft for a bottle bleed into another
// account's draft for a bottle that happens to share the same id.
function draftKey(uid: string, bottleId: string): string {
  return `fip-pour-draft:${uid}:${bottleId}`
}

function readDraft(uid: string, bottleId: string): PourDraft {
  try {
    const raw = localStorage.getItem(draftKey(uid, bottleId))
    if (!raw) return blankDraft()
    return { ...blankDraft(), ...(JSON.parse(raw) as Partial<PourDraft>) }
  } catch {
    return blankDraft()
  }
}

export function usePourDraft(bottleId: string) {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const [draft, setDraft] = useState<PourDraft>(() => readDraft(uid, bottleId))

  // Re-reads under the correct key once the signed-in uid is known/changes —
  // covers both the brief window before auth resolves on first mount and a
  // same-tab switch to a different account.
  useEffect(() => {
    setDraft(readDraft(uid, bottleId))
  }, [uid, bottleId])

  useEffect(() => {
    if (!uid) return
    try {
      localStorage.setItem(draftKey(uid, bottleId), JSON.stringify(draft))
    } catch {
      // Storage full or unavailable — draft persistence is best-effort.
    }
  }, [uid, bottleId, draft])

  const updateDraft = useCallback((patch: Partial<PourDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey(uid, bottleId))
    } catch {
      // ignore
    }
    setDraft(blankDraft())
  }, [uid, bottleId])

  return { draft, updateDraft, clearDraft }
}
