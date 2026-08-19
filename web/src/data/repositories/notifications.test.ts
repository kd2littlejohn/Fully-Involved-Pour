import { describe, expect, it, vi } from 'vitest'

vi.mock('../devMode', () => ({ isMockAuthEnabled: () => true }))

import { createNotification, getNotifications, markNotificationRead, unreadCount } from './notifications'

describe('createNotification / getNotifications', () => {
  it('starts unread and is scoped to its recipient', async () => {
    await createNotification({ recipientId: 'n1', type: 'friend-request-received', actorId: 'actor1', actorUsername: 'actor1', refId: 'ref1' })
    const notifications = await getNotifications('n1')
    expect(notifications).toHaveLength(1)
    expect(notifications[0]?.read).toBe(false)
    expect(await getNotifications('someone-else')).toEqual([])
  })
})

describe('markNotificationRead', () => {
  it('flips read to true without touching anything else', async () => {
    await createNotification({ recipientId: 'n2', type: 'bottle-recommended', actorId: 'actor2', actorUsername: 'actor2', refId: 'ref2' })
    const [notification] = await getNotifications('n2')
    await markNotificationRead(notification!.id)
    const [reloaded] = await getNotifications('n2')
    expect(reloaded?.read).toBe(true)
    expect(reloaded?.type).toBe('bottle-recommended')
  })
})

describe('unreadCount', () => {
  it('counts only unread notifications', () => {
    const notifications = [
      { read: false } as never,
      { read: true } as never,
      { read: false } as never,
    ]
    expect(unreadCount(notifications)).toBe(2)
  })
})
