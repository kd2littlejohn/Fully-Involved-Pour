import {
  acceptFriendRequest as acceptFriendRequestRepo,
  blockUser as blockUserRepo,
  cancelFriendRequest as cancelFriendRequestRepo,
  declineFriendRequest as declineFriendRequestRepo,
  removeFriend as removeFriendRepo,
  sendFriendRequest as sendFriendRequestRepo,
  unblockUser as unblockUserRepo,
} from '../../data/repositories/relationships'
import { createNotification } from '../../data/repositories/notifications'
import type { FriendRequest } from '../../data/types'

export interface ActingUser {
  uid: string
  username: string
  displayName?: string
  photoURL?: string
}

// Every write here pairs a real relationship/friendRequest mutation with the
// matching notification write, in one place, so no call site can forget one
// half — this is the single source of truth for what happens on send/accept.

export async function sendFriendRequestWithNotification(sender: ActingUser, receiverId: string): Promise<'sent' | 'accepted'> {
  const result = await sendFriendRequestRepo({
    senderId: sender.uid,
    senderUsername: sender.username,
    senderDisplayName: sender.displayName,
    senderPhotoURL: sender.photoURL,
    receiverId,
  })
  await createNotification({
    recipientId: receiverId,
    type: result === 'sent' ? 'friend-request-received' : 'friend-request-accepted',
    actorId: sender.uid,
    actorUsername: sender.username,
    actorDisplayName: sender.displayName,
    actorPhotoURL: sender.photoURL,
    refId: result === 'sent' ? `${sender.uid}_${receiverId}` : [sender.uid, receiverId].sort().join('_'),
  })
  return result
}

export async function acceptFriendRequestWithNotification(request: FriendRequest, receiver: ActingUser): Promise<void> {
  await acceptFriendRequestRepo(request)
  await createNotification({
    recipientId: request.senderId,
    type: 'friend-request-accepted',
    actorId: receiver.uid,
    actorUsername: receiver.username,
    actorDisplayName: receiver.displayName,
    actorPhotoURL: receiver.photoURL,
    refId: [request.senderId, request.receiverId].sort().join('_'),
  })
}

export async function declineFriendRequestAction(senderId: string, receiverId: string): Promise<void> {
  await declineFriendRequestRepo(senderId, receiverId)
}

export async function cancelFriendRequestAction(senderId: string, receiverId: string): Promise<void> {
  await cancelFriendRequestRepo(senderId, receiverId)
}

export async function removeFriendAction(uidA: string, uidB: string): Promise<void> {
  await removeFriendRepo(uidA, uidB)
}

export async function blockUserAction(blockerUid: string, blockedUid: string): Promise<void> {
  await blockUserRepo(blockerUid, blockedUid)
}

export async function unblockUserAction(blockerUid: string, blockedUid: string): Promise<void> {
  await unblockUserRepo(blockerUid, blockedUid)
}
