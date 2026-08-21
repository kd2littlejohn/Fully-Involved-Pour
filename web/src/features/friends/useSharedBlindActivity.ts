import { useEffect, useState } from 'react'
import { getMyBlindRooms, getParticipant } from '../../data/repositories/blindRoom'
import type { FriendProfile } from './useFriends'
import type { ActivityItem } from './activityItem'

// Caps how many of the viewer's own completed rooms get checked against
// friends — bounds the read count on a page that's meant to be a quick
// glance, not a full history (the full list already lives in Blind
// History / Our Whiskey Story).
const MAX_ROOMS_CHECKED = 20

// "Friend completed a blind" (see FriendsPage.tsx's Recent Friend
// Activity) — derived entirely from real BlindRoom participant records the
// viewer already has read access to (their own rooms), same lookup
// ourWhiskeyStory.ts uses for "blind tastings together." No new
// collection, no new rule: a room only ever surfaces here because the
// viewer was already a participant in it, same privacy boundary as
// everywhere else this data is read.
export function useSharedBlindActivity(uid: string | undefined, friends: FriendProfile[]) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid || friends.length === 0) {
      setItems([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    async function run(): Promise<ActivityItem[]> {
      const myRooms = (await getMyBlindRooms(uid as string))
        .filter(({ room }) => room.state === 'completed' && room.completedAt)
        .sort((a, b) => (b.room.completedAt ?? 0) - (a.room.completedAt ?? 0))
        .slice(0, MAX_ROOMS_CHECKED)

      const results: ActivityItem[] = []
      for (const { room } of myRooms) {
        const participantChecks = await Promise.all(friends.map((friend) => getParticipant(room.id, friend.uid)))
        friends.forEach((friend, i) => {
          if (!participantChecks[i]) return
          results.push({
            id: `blind-${room.id}-${friend.uid}`,
            actorId: friend.uid,
            actorName: friend.displayName || friend.username || 'FIP Friend',
            actorUsername: friend.username,
            actorPhotoURL: friend.photoURL,
            text: `You and ${friend.displayName || friend.username} completed a Blind Room`,
            subtitle: room.name,
            to: `/blind/${room.id}/reveal`,
            timestamp: room.completedAt as number,
            read: true,
          })
        })
      }
      return results
    }

    run()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((err) => {
        console.error('useSharedBlindActivity failed', err)
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [uid, friends])

  return { items, loading }
}
