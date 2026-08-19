import { useCallback, useEffect, useState } from 'react'
import { getNotifications, markNotificationRead, unreadCount } from '../../data/repositories/notifications'
import type { AppNotification } from '../../data/types'

export function useNotifications(uid: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!uid) {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    setNotifications(await getNotifications(uid))
    setLoading(false)
  }, [uid])

  useEffect(() => {
    load()
  }, [load])

  async function markRead(id: string) {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  return { notifications, unread: unreadCount(notifications), loading, reload: load, markRead }
}
