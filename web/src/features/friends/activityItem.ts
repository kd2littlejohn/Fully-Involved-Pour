// A single unified shape "Recent Friend Activity" renders from, regardless
// of which real data source it came from — notifications (see
// notificationCopy.ts) or a derived source like shared Blind Room
// completions (see useSharedBlindActivity.ts). Keeping one shape here means
// FriendActivityRow doesn't need to know which source produced an item.
export interface ActivityItem {
  id: string
  actorName: string
  actorPhotoURL?: string
  text: string
  subtitle?: string
  to?: string
  timestamp: number
  read: boolean
}
