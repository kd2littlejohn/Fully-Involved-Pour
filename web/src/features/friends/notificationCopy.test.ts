import { describe, expect, it } from 'vitest'
import { describeNotification, notificationToActivityItem } from './notificationCopy'
import type { AppNotification } from '../../data/types'

function notification(overrides: Partial<AppNotification> & Pick<AppNotification, 'type'>): AppNotification {
  return {
    id: 'n1',
    recipientId: 'me',
    actorId: 'friend-1',
    actorUsername: 'kevin',
    actorDisplayName: 'Kevin Littlejohn',
    refId: 'ref-1',
    read: false,
    createdAt: 1,
    ...overrides,
  }
}

describe('describeNotification', () => {
  it('describes a received friend request and points to the Requests tab', () => {
    const result = describeNotification(notification({ type: 'friend-request-received' }))
    expect(result.text).toBe('Kevin Littlejohn sent you a friend request')
    expect(result.to).toBe('/friends?tab=requests')
  })

  it('describes an accepted friend request and links to the actor’s profile', () => {
    const result = describeNotification(notification({ type: 'friend-request-accepted' }))
    expect(result.text).toBe('Kevin Littlejohn accepted your friend request')
    expect(result.to).toBe('/friends/u/kevin')
  })

  it('describes a tagged pour, includes the bottle name, and links to the shared story via refId', () => {
    const result = describeNotification(notification({ type: 'tagged-in-pour', refId: 'moment-42', refBottleName: 'Stagg Batch 23' }))
    expect(result.text).toBe('Kevin Littlejohn shared a Pour Story with you')
    expect(result.subtitle).toBe('Stagg Batch 23')
    expect(result.to).toBe('/friends/shared/moment-42')
  })

  it('describes a bottle recommendation, includes the bottle name, and links to the Shared tab', () => {
    const result = describeNotification(notification({ type: 'bottle-recommended', refBottleName: 'Weller 12' }))
    expect(result.text).toBe('Kevin Littlejohn recommended a bottle to you')
    expect(result.subtitle).toBe('Weller 12')
    expect(result.to).toBe('/friends?tab=shared')
  })

  it('describes a reaction and links to the shared story', () => {
    const result = describeNotification(notification({ type: 'story-reaction', refId: 'moment-7' }))
    expect(result.text).toBe('Kevin Littlejohn reacted to your shared pour')
    expect(result.to).toBe('/friends/shared/moment-7')
  })

  it('describes a comment and links to the shared story', () => {
    const result = describeNotification(notification({ type: 'story-comment', refId: 'moment-9' }))
    expect(result.text).toBe('Kevin Littlejohn commented on your shared pour')
    expect(result.to).toBe('/friends/shared/moment-9')
  })

  it('falls back to the username when there is no display name', () => {
    const result = describeNotification(notification({ type: 'friend-request-received', actorDisplayName: undefined }))
    expect(result.text).toBe('kevin sent you a friend request')
  })
})

describe('notificationToActivityItem', () => {
  it('adapts a notification into the shared ActivityItem shape used across every real activity source', () => {
    const item = notificationToActivityItem(
      notification({ type: 'tagged-in-pour', refId: 'moment-1', refBottleName: 'Stagg Batch 23', read: true, createdAt: 42 }),
    )
    expect(item).toEqual({
      id: 'n1',
      actorId: 'friend-1',
      actorName: 'Kevin Littlejohn',
      actorUsername: 'kevin',
      actorPhotoURL: undefined,
      text: 'Kevin Littlejohn shared a Pour Story with you',
      subtitle: 'Stagg Batch 23',
      to: '/friends/shared/moment-1',
      timestamp: 42,
      read: true,
      bottleName: 'Stagg Batch 23',
    })
  })
})
