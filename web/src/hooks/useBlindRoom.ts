import { useCallback, useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../data/firebase'
import { isMockAuthEnabled } from '../data/devMode'
import { getBlindRoom, getParticipants } from '../data/repositories/blindRoom'
import type { BlindParticipant, BlindRoom } from '../data/types'

interface UseBlindRoomResult {
  room: BlindRoom | undefined
  participants: BlindParticipant[]
  loading: boolean
  refresh: () => void
}

// The app's first real-time Firestore subscription — everywhere else reads
// once via getDoc/getDocs (see web/src/data/repositories/userDoc.ts). The
// lobby genuinely needs live participant status (someone else tapping
// "Ready" should show up without a manual refresh), so this is the one
// place onSnapshot earns its keep rather than a broader pattern change.
//
// Dev-mode mock auth only ever simulates one signed-in user, so there's no
// second participant whose writes a listener would ever pick up — falls
// back to a one-shot fetch (plus a manual `refresh()`) rather than a fake
// listener that would just sit idle.
export function useBlindRoom(roomId: string | undefined): UseBlindRoomResult {
  const [room, setRoom] = useState<BlindRoom | undefined>(undefined)
  const [participants, setParticipants] = useState<BlindParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), [])

  useEffect(() => {
    if (!roomId) {
      setRoom(undefined)
      setParticipants([])
      setLoading(false)
      return
    }

    if (isMockAuthEnabled()) {
      let cancelled = false
      setLoading(true)
      Promise.all([getBlindRoom(roomId), getParticipants(roomId)]).then(([nextRoom, nextParticipants]) => {
        if (cancelled) return
        setRoom(nextRoom)
        setParticipants(nextParticipants)
        setLoading(false)
      })
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    const unsubRoom = onSnapshot(doc(db, 'blindRooms', roomId), (snap) => {
      setRoom(snap.exists() ? (snap.data() as BlindRoom) : undefined)
      setLoading(false)
    })
    const unsubParticipants = onSnapshot(collection(db, 'blindRooms', roomId, 'participants'), (snap) => {
      setParticipants(snap.docs.map((d) => d.data() as BlindParticipant))
    })

    return () => {
      unsubRoom()
      unsubParticipants()
    }
  }, [roomId, refreshToken])

  return { room, participants, loading, refresh }
}
