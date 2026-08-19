import { useCallback, useEffect, useState } from 'react'
import { getFriendIds } from '../../data/repositories/relationships'
import { fetchProfile } from '../../data/repositories/profile'
import type { Profile } from '../../data/types'

export interface FriendProfile extends Profile {
  uid: string
}

export function useFriends(uid: string | undefined): { friends: FriendProfile[]; loading: boolean; reload: () => void } {
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    if (!uid) {
      setFriends([])
      setLoading(false)
      return
    }
    setLoading(true)
    const friendIds = await getFriendIds(uid)
    const resolved = await Promise.all(
      friendIds.map(async (friendUid) => {
        const friendProfile = await fetchProfile(friendUid)
        return friendProfile ? { uid: friendUid, ...friendProfile } : undefined
      }),
    )
    setFriends(resolved.filter((p): p is FriendProfile => Boolean(p)))
    setLoading(false)
  }, [uid])

  useEffect(() => {
    load()
  }, [load, reloadKey])

  return { friends, loading, reload: () => setReloadKey((k) => k + 1) }
}
