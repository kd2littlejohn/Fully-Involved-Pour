import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useFriends } from '../friends/useFriends'
import { useNotifications } from '../friends/useNotifications'
import { useSharedBlindActivity } from '../friends/useSharedBlindActivity'
import { notificationToActivityItem } from '../friends/notificationCopy'
import { FriendActivityRow } from '../friends/FriendActivityRow'
import { FriendBottleQuickView, type FriendBottleQuickViewTarget } from '../friends/FriendBottleQuickView'
import type { ActivityItem } from '../friends/activityItem'
import styles from './FriendsRecentPoursCard.module.css'

const PREVIEW_COUNT = 3

// A small teaser of Recent Friend Activity (see FriendsPage.tsx, the fuller
// version of this same feed) — reuses the exact same data sources and row
// component rather than building a second activity reader.
export function FriendsRecentPoursCard() {
  const { user } = useAuth()
  const { friends, loading: friendsLoading } = useFriends(user?.uid)
  const { notifications, loading: notificationsLoading, markRead } = useNotifications(user?.uid)
  const { items: blindActivity, loading: blindActivityLoading } = useSharedBlindActivity(user?.uid, friends)
  const [quickView, setQuickView] = useState<FriendBottleQuickViewTarget | undefined>(undefined)

  const loading = friendsLoading || notificationsLoading || blindActivityLoading
  const activity = [...notifications.map(notificationToActivityItem), ...blindActivity].sort((a, b) => b.timestamp - a.timestamp)
  const preview = activity.slice(0, PREVIEW_COUNT)

  function openActivity(id: string) {
    if (notifications.some((n) => n.id === id)) markRead(id)
  }

  function openBottleFromActivity(item: ActivityItem) {
    if (!item.bottleName) return
    setQuickView({ friendUid: item.actorId, friendName: item.actorName, friendUsername: item.actorUsername, bottleName: item.bottleName })
  }

  if (loading) return null

  if (friends.length === 0) {
    return (
      <EmptyState
        title="Whiskey is better shared."
        message="Add a few friends to see their pours here."
        action={
          <Link to="/friends/add">
            <Button variant="secondary">Find Friends</Button>
          </Link>
        }
      />
    )
  }

  if (activity.length === 0) {
    return <EmptyState title="Quiet on the friends front." message="When a friend pours, tastes blind, or shares a story, it shows up here." />
  }

  return (
    <>
      <div className={styles.list}>
        {preview.map((item) => (
          <FriendActivityRow key={item.id} item={item} onOpen={openActivity} onTapBottle={openBottleFromActivity} />
        ))}
      </div>
      <FriendBottleQuickView target={quickView} onClose={() => setQuickView(undefined)} />
    </>
  )
}
