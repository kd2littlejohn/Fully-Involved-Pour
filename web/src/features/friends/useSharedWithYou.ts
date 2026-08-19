import { useCallback, useEffect, useState } from 'react'
import { getSharedMomentsForParticipant } from '../../data/repositories/sharedMoments'
import { getRecommendationsForRecipient } from '../../data/repositories/recommendations'
import type { Recommendation, SharedMoment } from '../../data/types'

export type SharedItem = { kind: 'shared-moment'; moment: SharedMoment } | { kind: 'recommendation'; recommendation: Recommendation }

function itemTime(item: SharedItem): number {
  return item.kind === 'shared-moment' ? item.moment.createdAt : item.recommendation.createdAt
}

// "Shared With You" — meaningful items only: pours friends tagged you in,
// and bottle recommendations still waiting on you. Never every minor
// friend action; that's the whole point of this tab over a generic feed.
export function useSharedWithYou(uid: string | undefined) {
  const [items, setItems] = useState<SharedItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!uid) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [moments, recommendations] = await Promise.all([getSharedMomentsForParticipant(uid), getRecommendationsForRecipient(uid)])
    const merged: SharedItem[] = [
      ...moments.map((moment) => ({ kind: 'shared-moment' as const, moment })),
      ...recommendations.filter((r) => r.status === 'pending').map((recommendation) => ({ kind: 'recommendation' as const, recommendation })),
    ].sort((a, b) => itemTime(b) - itemTime(a))
    setItems(merged)
    setLoading(false)
  }, [uid])

  useEffect(() => {
    load()
  }, [load])

  return { items, loading, reload: load }
}
