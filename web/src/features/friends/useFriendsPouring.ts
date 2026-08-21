import { useEffect, useState } from 'react'
import { getSharedCollection } from '../../data/repositories/sharedCollections'
import type { FriendProfile } from './useFriends'

export interface FriendPouring {
  uid: string
  displayName?: string
  username?: string
  photoURL?: string
  bottleName?: string
}

// Bounds how many friends' sharedCollections this fetches at once — "Friends
// Are Pouring" is a compact preview row, not a request to read every
// friend's shared bar.
const MAX_FRIENDS = 10

// "Friends Are Pouring" (see FriendsPage.tsx) — real data only: a friend's
// most recent bottle here comes from their own owner-computed
// sharedCollections/{uid} projection (data/repositories/sharedCollections.ts),
// which already only exists/reads when their own privacy settings allow it
// (see firestore.rules sharedCollections/{ownerUid}). A friend who hasn't
// opted collectionVisibility into 'friends' or 'fip-users' — the default —
// just shows their avatar and name with no bottle line, never a fabricated
// "pouring now" state.
export function useFriendsPouring(friends: FriendProfile[]) {
  const [items, setItems] = useState<FriendPouring[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (friends.length === 0) {
      setItems([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    const subset = friends.slice(0, MAX_FRIENDS)
    Promise.all(
      subset.map(async (friend) => {
        const collection = await getSharedCollection(friend.uid).catch(() => undefined)
        const recentBottle = collection?.bottles.find((b) => b.status === 'open') ?? collection?.bottles[0]
        return {
          uid: friend.uid,
          displayName: friend.displayName,
          username: friend.username,
          photoURL: friend.photoURL,
          bottleName: recentBottle?.name,
        }
      }),
    ).then((result) => {
      if (!cancelled) {
        setItems(result)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [friends])

  return { items, loading }
}
