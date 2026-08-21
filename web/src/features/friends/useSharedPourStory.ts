import { useEffect, useState } from 'react'
import { getSharedMoment } from '../../data/repositories/sharedMoments'
import { fetchProfile } from '../../data/repositories/profile'
import type { Profile, SharedMoment } from '../../data/types'

export interface SharedPourStoryParticipant extends Profile {
  uid: string
}

export interface SharedPourStoryData {
  moment: SharedMoment
  // Owner first, then tagged participants in the order they were tagged —
  // matches the "Shared with" avatar row order in the mockup.
  people: SharedPourStoryParticipant[]
}

// A moment doc a viewer isn't the owner or a tagged participant of is
// denied by firestore.rules (see canAccessMoment), which surfaces to the
// client SDK as a thrown permission-denied error, not a resolved "doesn't
// exist" — caught here and folded into the same notFound state as a
// genuinely missing id, same as useFriendProfile does for a bad username.
export function useSharedPourStory(momentId: string | undefined) {
  const [data, setData] = useState<SharedPourStoryData | undefined>(undefined)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!momentId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setNotFound(false)

    async function run(): Promise<SharedPourStoryData | undefined> {
      const moment = await getSharedMoment(momentId as string)
      if (!moment) return undefined
      const uids = [moment.ownerId, ...moment.participantIds]
      const profiles = await Promise.all(uids.map((uid) => fetchProfile(uid).catch(() => undefined)))
      const people = uids
        .map((uid, i) => (profiles[i] ? { uid, ...(profiles[i] as Profile) } : undefined))
        .filter((p): p is SharedPourStoryParticipant => Boolean(p))
      return { moment, people }
    }

    run()
      .then((result) => {
        if (cancelled) return
        if (!result) setNotFound(true)
        else setData(result)
      })
      .catch((err) => {
        console.error('useSharedPourStory failed', err)
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [momentId])

  return { data, loading, notFound }
}
