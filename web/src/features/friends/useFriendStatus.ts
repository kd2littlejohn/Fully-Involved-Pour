import { useCallback, useEffect, useState } from 'react'
import { getFriendStatus, type FriendStatus } from '../../data/repositories/relationships'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import {
  blockUserAction,
  cancelFriendRequestAction,
  removeFriendAction,
  sendFriendRequestWithNotification,
  unblockUserAction,
} from './friendActions'

export type { FriendStatus }

// The full relationship state between the signed-in user and one other
// uid, plus every action a Friend Profile / search result / request card
// needs — each action re-fetches status afterward so the UI always
// reflects the real, just-written state rather than an optimistic guess.
export function useFriendStatus(targetUid: string | undefined) {
  const { user } = useAuth()
  const { userDoc, profile } = useUserData()
  const [status, setStatus] = useState<FriendStatus>('none')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const refresh = useCallback(async () => {
    if (!user || !targetUid) {
      setStatus('none')
      setLoading(false)
      return
    }
    setLoading(true)
    setStatus(await getFriendStatus(user.uid, targetUid))
    setLoading(false)
  }, [user, targetUid])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function withAction(fn: () => Promise<void>) {
    setActing(true)
    try {
      await fn()
      await refresh()
    } finally {
      setActing(false)
    }
  }

  async function send() {
    if (!user || !targetUid) return
    await withAction(() =>
      sendFriendRequestWithNotification(
        {
          uid: user.uid,
          username: userDoc.username ?? '',
          displayName: profile?.displayName || user.displayName || undefined,
          photoURL: profile?.photoURL,
        },
        targetUid,
      ).then(() => undefined),
    )
  }

  async function cancel() {
    if (!user || !targetUid) return
    await withAction(() => cancelFriendRequestAction(user.uid, targetUid))
  }

  async function remove() {
    if (!user || !targetUid) return
    await withAction(() => removeFriendAction(user.uid, targetUid))
  }

  async function block() {
    if (!user || !targetUid) return
    await withAction(() => blockUserAction(user.uid, targetUid))
  }

  async function unblock() {
    if (!user || !targetUid) return
    await withAction(() => unblockUserAction(user.uid, targetUid))
  }

  return { status, loading, acting, send, cancel, remove, block, unblock, refresh }
}
