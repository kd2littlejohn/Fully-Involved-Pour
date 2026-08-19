import { describe, expect, it, vi } from 'vitest'

vi.mock('../devMode', () => ({ isMockAuthEnabled: () => true }))

import {
  AlreadyFriendsError,
  BlockedError,
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  getFriendIds,
  getFriendStatus,
  getIncomingRequests,
  getOutgoingRequests,
  getRelationship,
  removeFriend,
  sendFriendRequest,
  unblockUser,
} from './relationships'

function sender(overrides: Partial<Parameters<typeof sendFriendRequest>[0]> = {}) {
  return { senderId: 'alice', senderUsername: 'alice', receiverId: 'bob', ...overrides }
}

describe('sendFriendRequest / getFriendStatus', () => {
  it('starts as none between two strangers', async () => {
    expect(await getFriendStatus('a1', 'b1')).toBe('none')
  })

  it('creates a pending request visible as outgoing to the sender and incoming to the receiver', async () => {
    await sendFriendRequest(sender({ senderId: 'u1', receiverId: 'u2' }))
    expect(await getFriendStatus('u1', 'u2')).toBe('outgoing_pending')
    expect(await getFriendStatus('u2', 'u1')).toBe('incoming_pending')
  })

  it('accepting the other side of an existing pending request instead of crossing two requests', async () => {
    await sendFriendRequest(sender({ senderId: 'u3', receiverId: 'u4' }))
    const result = await sendFriendRequest(sender({ senderId: 'u4', receiverId: 'u3', senderUsername: 'bob' }))
    expect(result).toBe('accepted')
    expect(await getFriendStatus('u3', 'u4')).toBe('friends')
    expect(await getFriendStatus('u4', 'u3')).toBe('friends')
  })

  it('refuses to send a request to someone already a friend', async () => {
    await sendFriendRequest(sender({ senderId: 'u5', receiverId: 'u6' }))
    const incoming = await getIncomingRequests('u6')
    await acceptFriendRequest(incoming[0]!)
    await expect(sendFriendRequest(sender({ senderId: 'u5', receiverId: 'u6' }))).rejects.toBeInstanceOf(AlreadyFriendsError)
  })

  it('refuses to send a request to someone who blocked the sender', async () => {
    await blockUser('u8', 'u7')
    await expect(sendFriendRequest(sender({ senderId: 'u7', receiverId: 'u8' }))).rejects.toBeInstanceOf(BlockedError)
  })
})

describe('cancel / decline', () => {
  it('cancelling a request clears it from both incoming and outgoing lists', async () => {
    await sendFriendRequest(sender({ senderId: 'c1', receiverId: 'c2' }))
    await cancelFriendRequest('c1', 'c2')
    expect(await getFriendStatus('c1', 'c2')).toBe('none')
    expect(await getOutgoingRequests('c1')).toEqual([])
  })

  it('declining a request clears it without creating a relationship', async () => {
    await sendFriendRequest(sender({ senderId: 'd1', receiverId: 'd2' }))
    await declineFriendRequest('d1', 'd2')
    expect(await getFriendStatus('d1', 'd2')).toBe('none')
    expect(await getRelationship('d1', 'd2')).toBeUndefined()
  })
})

describe('acceptFriendRequest', () => {
  it('creates a symmetric friends relationship queryable by getFriendIds from either side', async () => {
    await sendFriendRequest(sender({ senderId: 'e1', receiverId: 'e2' }))
    const [incoming] = await getIncomingRequests('e2')
    await acceptFriendRequest(incoming!)
    expect(await getFriendIds('e1')).toContain('e2')
    expect(await getFriendIds('e2')).toContain('e1')
  })
})

describe('removeFriend', () => {
  it('deletes the relationship so both people fall back to none', async () => {
    await sendFriendRequest(sender({ senderId: 'f1', receiverId: 'f2' }))
    const [incoming] = await getIncomingRequests('f2')
    await acceptFriendRequest(incoming!)
    await removeFriend('f1', 'f2')
    expect(await getFriendStatus('f1', 'f2')).toBe('none')
  })
})

describe('blockUser / unblockUser', () => {
  it('marks the blocker as blocked and the blocked party as blocked_by', async () => {
    await blockUser('g1', 'g2')
    expect(await getFriendStatus('g1', 'g2')).toBe('blocked')
    expect(await getFriendStatus('g2', 'g1')).toBe('blocked_by')
  })

  it('unblocking clears the relationship back to none', async () => {
    await blockUser('h1', 'h2')
    await unblockUser('h1', 'h2')
    expect(await getFriendStatus('h1', 'h2')).toBe('none')
  })
})
