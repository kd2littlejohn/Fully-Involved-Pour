import { useCallback, useEffect, useState } from 'react'
import { getIncomingRequests, getOutgoingRequests } from '../../data/repositories/relationships'
import type { FriendRequest } from '../../data/types'

export function useFriendRequests(uid: string | undefined) {
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!uid) {
      setIncoming([])
      setOutgoing([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [inc, out] = await Promise.all([getIncomingRequests(uid), getOutgoingRequests(uid)])
    setIncoming(inc)
    setOutgoing(out)
    setLoading(false)
  }, [uid])

  useEffect(() => {
    load()
  }, [load])

  return { incoming, outgoing, loading, reload: load }
}
