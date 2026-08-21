import type { AppNotification } from '../../data/types'
import type { ActivityItem } from './activityItem'

export interface NotificationDescription {
  text: string
  // The bottle/pour this notification is actually about — refBottleName
  // (see AppNotification) when the notification carries one. Undefined for
  // friend-request-received/accepted, which aren't about a bottle at all.
  subtitle?: string
  // Omitted when there's nowhere meaningful to send a tap — e.g. a bottle
  // recommendation, which has its own action buttons in the Shared With
  // You list rather than a dedicated detail page.
  to?: string
}

// One line of "what happened" per notification, for Recent Friend Activity
// (see FriendsPage.tsx) — reuses the existing notification backend
// (data/repositories/notifications.ts) rather than a new activity feed, so
// it only ever shows things the viewer is actually privy to (their own
// notifications), never another friend's private actions. See refId
// semantics at each createNotification call site (friendActions.ts,
// shareStoryOnSave.ts, ReactionBar.tsx, CommentsList.tsx,
// RecommendToFriendModal.tsx) for what refId points to per type.
export function describeNotification(notification: AppNotification): NotificationDescription {
  const actor = notification.actorDisplayName || notification.actorUsername
  switch (notification.type) {
    case 'friend-request-received':
      return { text: `${actor} sent you a friend request`, to: '/friends?tab=requests' }
    case 'friend-request-accepted':
      return { text: `${actor} accepted your friend request`, to: `/friends/u/${notification.actorUsername}` }
    case 'tagged-in-pour':
      return {
        text: `${actor} shared a Pour Story with you`,
        subtitle: notification.refBottleName,
        to: `/friends/shared/${notification.refId}`,
      }
    case 'bottle-recommended':
      return { text: `${actor} recommended a bottle to you`, subtitle: notification.refBottleName, to: '/friends?tab=shared' }
    case 'story-reaction':
      return {
        text: `${actor} reacted to your shared pour`,
        subtitle: notification.refBottleName,
        to: `/friends/shared/${notification.refId}`,
      }
    case 'story-comment':
      return {
        text: `${actor} commented on your shared pour`,
        subtitle: notification.refBottleName,
        to: `/friends/shared/${notification.refId}`,
      }
    default:
      return { text: `${actor} did something` }
  }
}

// Adapts a notification into the same ActivityItem shape the derived
// sources (see useSharedBlindActivity.ts) already produce, so
// FriendsPage.tsx can merge and sort every kind of real activity together.
export function notificationToActivityItem(notification: AppNotification): ActivityItem {
  const { text, subtitle, to } = describeNotification(notification)
  return {
    id: notification.id,
    actorName: notification.actorDisplayName || notification.actorUsername,
    actorPhotoURL: notification.actorPhotoURL,
    text,
    subtitle,
    to,
    timestamp: notification.createdAt,
    read: notification.read,
  }
}
