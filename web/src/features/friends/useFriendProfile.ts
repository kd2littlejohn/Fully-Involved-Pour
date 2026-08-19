import { useEffect, useState } from 'react'
import { resolveUsername } from '../../data/repositories/username'
import { fetchProfile } from '../../data/repositories/profile'
import { getSharedCollection } from '../../data/repositories/sharedCollections'
import { getSharedMomentsForOwner } from '../../data/repositories/sharedMoments'
import type { Profile, SharedCollection, SharedMoment } from '../../data/types'

export interface FriendProfileData {
  uid: string
  profile: Profile
  // undefined here means "not visible to me" (private, or genuinely
  // nothing shared yet) — never distinguished from each other, since
  // distinguishing them would itself leak whether the owner has any
  // bottles at all.
  sharedCollection?: SharedCollection
  sharedMomentsWithViewer: SharedMoment[]
}

export function useFriendProfile(username: string | undefined, viewerUid: string | undefined) {
  const [data, setData] = useState<FriendProfileData | undefined>(undefined)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setNotFound(false)

    async function run(): Promise<FriendProfileData | undefined> {
      const uid = await resolveUsername(username as string)
      if (!uid) return undefined
      const profile = await fetchProfile(uid)
      if (!profile) return undefined
      const [sharedCollection, ownedMoments] = await Promise.all([
        getSharedCollection(uid).catch(() => undefined),
        getSharedMomentsForOwner(uid).catch(() => [] as SharedMoment[]),
      ])
      const sharedMomentsWithViewer = viewerUid ? ownedMoments.filter((m) => m.participantIds.includes(viewerUid)) : []
      return { uid, profile, sharedCollection, sharedMomentsWithViewer }
    }

    run()
      .then((result) => {
        if (cancelled) return
        if (!result) setNotFound(true)
        else setData(result)
      })
      .catch((err) => {
        console.error('useFriendProfile failed', err)
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [username, viewerUid])

  return { data, loading, notFound }
}
