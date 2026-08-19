import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { FriendRequest, Relationship } from '../types'

export class AlreadyFriendsError extends Error {}
export class BlockedError extends Error {}

// The full derived relationship state a viewer can be in with another
// user — 'none'/'outgoing_pending'/'incoming_pending' are never stored,
// only ever computed from the absence of a Relationship doc plus whatever
// FriendRequest exists (see getFriendStatus below).
export type FriendStatus = 'none' | 'outgoing_pending' | 'incoming_pending' | 'friends' | 'blocked' | 'blocked_by'

function pairId(a: string, b: string): string {
  return [a, b].sort().join('_')
}

function requestId(senderId: string, receiverId: string): string {
  return `${senderId}_${receiverId}`
}

function now(): number {
  return Date.now()
}

// --- Mock-mode fallback -----------------------------------------------
// Same in-memory-Map pattern as data/repositories/blindRoom.ts — the dev
// fixture session only ever simulates one signed-in user, so this can't
// exercise a real second account, but it still needs to not crash dev-mode
// browsing.
const mockRelationships = new Map<string, Relationship>()
const mockRequests = new Map<string, FriendRequest>()

// A cached, single seeding promise — every exported function below awaits
// this before touching the mock store, so no caller can ever read the
// store before it's seeded no matter which function is called first (a
// fire-and-forget dynamic import on app mount had exactly that race: a
// component could call getFriendIds before the import resolved and see an
// empty list). Resolves instantly outside mock mode.
let seedPromise: Promise<void> | undefined

function ensureSeeded(): Promise<void> {
  if (!isMockAuthEnabled()) return Promise.resolve()
  if (!seedPromise) {
    seedPromise = import('../mockSocialData').then(({ MOCK_RELATIONSHIPS, MOCK_FRIEND_REQUESTS }) => {
      for (const relationship of MOCK_RELATIONSHIPS) mockRelationships.set(relationship.id, relationship)
      for (const request of MOCK_FRIEND_REQUESTS) mockRequests.set(request.id, request)
    })
  }
  return seedPromise
}

async function fetchRequest(id: string): Promise<FriendRequest | undefined> {
  await ensureSeeded()
  if (isMockAuthEnabled()) return mockRequests.get(id)
  const snap = await getDoc(doc(db, 'friendRequests', id))
  return snap.exists() ? (snap.data() as FriendRequest) : undefined
}

// --- Reads ---------------------------------------------------------------

export async function getRelationship(uidA: string, uidB: string): Promise<Relationship | undefined> {
  await ensureSeeded()
  const id = pairId(uidA, uidB)
  if (isMockAuthEnabled()) return mockRelationships.get(id)
  const snap = await getDoc(doc(db, 'relationships', id))
  return snap.exists() ? (snap.data() as Relationship) : undefined
}

export async function getFriendStatus(viewerUid: string, otherUid: string): Promise<FriendStatus> {
  if (viewerUid === otherUid) return 'none'
  const relationship = await getRelationship(viewerUid, otherUid)
  if (relationship?.status === 'friends') return 'friends'
  if (relationship?.status === 'blocked') return relationship.requestedBy === viewerUid ? 'blocked' : 'blocked_by'

  const [outgoing, incoming] = await Promise.all([
    fetchRequest(requestId(viewerUid, otherUid)),
    fetchRequest(requestId(otherUid, viewerUid)),
  ])
  if (outgoing?.status === 'pending') return 'outgoing_pending'
  if (incoming?.status === 'pending') return 'incoming_pending'
  return 'none'
}

// Kept to a single array-contains + single equality filter throughout this
// file — Firestore only auto-indexes that combination; a second equality
// clause alongside array-contains would need a manually-declared composite
// index, which this app doesn't maintain (see data/repositories/blindRoom.ts
// for the same discipline around collection-group queries).
export async function getFriendIds(uid: string): Promise<string[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockRelationships.values()]
      .filter((r) => r.status === 'friends' && r.userIds.includes(uid))
      .map((r) => r.userIds.find((id) => id !== uid))
      .filter((id): id is string => Boolean(id))
  }
  const snap = await getDocs(
    query(collection(db, 'relationships'), where('userIds', 'array-contains', uid), where('status', '==', 'friends')),
  )
  return snap.docs
    .map((d) => (d.data() as Relationship).userIds.find((id) => id !== uid))
    .filter((id): id is string => Boolean(id))
}

export async function getIncomingRequests(uid: string): Promise<FriendRequest[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockRequests.values()]
      .filter((r) => r.receiverId === uid && r.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt)
  }
  const snap = await getDocs(query(collection(db, 'friendRequests'), where('receiverId', '==', uid), where('status', '==', 'pending')))
  return snap.docs.map((d) => d.data() as FriendRequest).sort((a, b) => b.createdAt - a.createdAt)
}

export async function getOutgoingRequests(uid: string): Promise<FriendRequest[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockRequests.values()].filter((r) => r.senderId === uid && r.status === 'pending')
  }
  const snap = await getDocs(query(collection(db, 'friendRequests'), where('senderId', '==', uid), where('status', '==', 'pending')))
  return snap.docs.map((d) => d.data() as FriendRequest)
}

// --- Writes ----------------------------------------------------------------

export interface SendFriendRequestInput {
  senderId: string
  senderUsername: string
  senderDisplayName?: string
  senderPhotoURL?: string
  receiverId: string
}

// Sending a request when the other person already sent one just accepts
// theirs instead of creating a crossed pair of pending requests — checked
// before writing anything.
export async function sendFriendRequest(input: SendFriendRequestInput): Promise<'sent' | 'accepted'> {
  await ensureSeeded()
  const { senderId, receiverId } = input
  if (senderId === receiverId) throw new Error('You cannot friend yourself.')

  const existingRelationship = await getRelationship(senderId, receiverId)
  if (existingRelationship?.status === 'friends') throw new AlreadyFriendsError('You are already friends.')
  if (existingRelationship?.status === 'blocked') throw new BlockedError('You cannot send a request to this person.')

  const reverse = await fetchRequest(requestId(receiverId, senderId))
  if (reverse?.status === 'pending') {
    await acceptFriendRequest(reverse)
    return 'accepted'
  }

  const id = requestId(senderId, receiverId)
  const request: FriendRequest = {
    id,
    senderId,
    senderUsername: input.senderUsername,
    senderDisplayName: input.senderDisplayName,
    senderPhotoURL: input.senderPhotoURL,
    receiverId,
    status: 'pending',
    createdAt: now(),
    updatedAt: now(),
  }

  if (isMockAuthEnabled()) {
    mockRequests.set(id, request)
    return 'sent'
  }
  await setDoc(doc(db, 'friendRequests', id), request)
  return 'sent'
}

export async function cancelFriendRequest(senderId: string, receiverId: string): Promise<void> {
  await ensureSeeded()
  const id = requestId(senderId, receiverId)
  const patch = { status: 'cancelled' as const, updatedAt: now() }
  if (isMockAuthEnabled()) {
    const existing = mockRequests.get(id)
    if (existing) mockRequests.set(id, { ...existing, ...patch })
    return
  }
  await updateDoc(doc(db, 'friendRequests', id), patch)
}

export async function declineFriendRequest(senderId: string, receiverId: string): Promise<void> {
  await ensureSeeded()
  const id = requestId(senderId, receiverId)
  const patch = { status: 'declined' as const, updatedAt: now() }
  if (isMockAuthEnabled()) {
    const existing = mockRequests.get(id)
    if (existing) mockRequests.set(id, { ...existing, ...patch })
    return
  }
  await updateDoc(doc(db, 'friendRequests', id), patch)
}

// Sequential, not a single transaction — same reasoning as
// blindRoom.ts's createBlindRoom: each write's own security rule is
// evaluated independently against already-committed state, which keeps
// both rules simple at the cost of a relationship very rarely being left
// without its request marked accepted if the second write fails.
export async function acceptFriendRequest(request: FriendRequest): Promise<void> {
  await ensureSeeded()
  const relationshipId = pairId(request.senderId, request.receiverId)
  const relationship: Relationship = {
    id: relationshipId,
    userIds: [request.senderId, request.receiverId].sort() as [string, string],
    status: 'friends',
    requestedBy: request.senderId,
    createdAt: now(),
    updatedAt: now(),
  }
  const requestPatch = { status: 'accepted' as const, updatedAt: now() }

  if (isMockAuthEnabled()) {
    mockRelationships.set(relationshipId, relationship)
    mockRequests.set(request.id, { ...request, ...requestPatch })
    return
  }

  await setDoc(doc(db, 'relationships', relationshipId), relationship)
  await updateDoc(doc(db, 'friendRequests', request.id), requestPatch)
}

export async function removeFriend(uidA: string, uidB: string): Promise<void> {
  await ensureSeeded()
  const id = pairId(uidA, uidB)
  if (isMockAuthEnabled()) {
    mockRelationships.delete(id)
    return
  }
  await deleteDoc(doc(db, 'relationships', id))
}

export async function blockUser(blockerUid: string, blockedUid: string): Promise<void> {
  await ensureSeeded()
  const id = pairId(blockerUid, blockedUid)
  const relationship: Relationship = {
    id,
    userIds: [blockerUid, blockedUid].sort() as [string, string],
    status: 'blocked',
    requestedBy: blockerUid,
    createdAt: now(),
    updatedAt: now(),
  }
  if (isMockAuthEnabled()) {
    mockRelationships.set(id, relationship)
    return
  }
  await setDoc(doc(db, 'relationships', id), relationship)
}

// Unblocking simply clears the relationship doc — matches the everyday
// meaning of "no relationship exists" and lets either party send a fresh
// friend request afterward if they want to.
export async function unblockUser(blockerUid: string, blockedUid: string): Promise<void> {
  await removeFriend(blockerUid, blockedUid)
}
