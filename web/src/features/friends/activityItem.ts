// A single unified shape "Recent Friend Activity" renders from, regardless
// of which real data source it came from — notifications (see
// notificationCopy.ts) or a derived source like shared Blind Room
// completions (see useSharedBlindActivity.ts). Keeping one shape here means
// FriendActivityRow doesn't need to know which source produced an item.
export interface ActivityItem {
  id: string
  actorId: string
  actorName: string
  actorUsername?: string
  actorPhotoURL?: string
  text: string
  subtitle?: string
  to?: string
  timestamp: number
  read: boolean
  // The bottle this activity is actually about, when there is one — set
  // only for the four notification types that carry a real bottle name
  // (see AppNotification.refBottleName). When present, tapping the row
  // opens Friend Bottle Quick View instead of navigating away (see
  // FriendsPage.tsx); when absent (a friend-request event), it falls back
  // to `to`.
  bottleName?: string
}
