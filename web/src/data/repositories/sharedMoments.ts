import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { SharedMoment, SharedMomentParticipantNote, StoryComment, StoryReaction, StoryReactionType } from '../types'

function now(): number {
  return Date.now()
}

// --- Mock-mode fallback -----------------------------------------------
const mockMoments = new Map<string, SharedMoment>()
const mockParticipantNotes = new Map<string, SharedMomentParticipantNote>() // key `${momentId}:${uid}`
const mockReactions = new Map<string, StoryReaction>()
const mockComments = new Map<string, StoryComment>()

function mockGenerateId(prefix: string): string {
  return `mock-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// A cached, single seeding promise every exported function awaits before
// touching the mock store — see the identical comment in
// data/repositories/relationships.ts for why a fire-and-forget import on
// app mount isn't safe here.
let seedPromise: Promise<void> | undefined

function ensureSeeded(): Promise<void> {
  if (!isMockAuthEnabled()) return Promise.resolve()
  if (!seedPromise) {
    seedPromise = import('../mockSocialData').then(({ MOCK_SHARED_MOMENTS, MOCK_REACTIONS, MOCK_COMMENTS }) => {
      for (const moment of MOCK_SHARED_MOMENTS) mockMoments.set(moment.id, moment)
      for (const reaction of MOCK_REACTIONS) mockReactions.set(reaction.id, reaction)
      for (const comment of MOCK_COMMENTS) mockComments.set(comment.id, comment)
    })
  }
  return seedPromise
}

// --- Shared moments --------------------------------------------------------

export interface CreateSharedMomentInput {
  storyId: string
  ownerId: string
  ownerUsername: string
  ownerDisplayName?: string
  ownerPhotoURL?: string
  participantIds: string[]
  snapshot: SharedMoment['snapshot']
}

export async function createSharedMoment(input: CreateSharedMomentInput): Promise<SharedMoment> {
  await ensureSeeded()
  const id = isMockAuthEnabled() ? mockGenerateId('moment') : doc(collection(db, 'sharedMoments')).id
  const moment: SharedMoment = {
    id,
    storyId: input.storyId,
    ownerId: input.ownerId,
    ownerUsername: input.ownerUsername,
    ownerDisplayName: input.ownerDisplayName,
    ownerPhotoURL: input.ownerPhotoURL,
    participantIds: input.participantIds,
    acceptedParticipantIds: [],
    snapshot: input.snapshot,
    createdAt: now(),
  }
  if (isMockAuthEnabled()) {
    mockMoments.set(id, moment)
    return moment
  }
  await setDoc(doc(db, 'sharedMoments', id), moment)
  return moment
}

export async function getSharedMoment(id: string): Promise<SharedMoment | undefined> {
  await ensureSeeded()
  if (isMockAuthEnabled()) return mockMoments.get(id)
  const snap = await getDoc(doc(db, 'sharedMoments', id))
  return snap.exists() ? (snap.data() as SharedMoment) : undefined
}

export async function getSharedMomentsForOwner(ownerId: string): Promise<SharedMoment[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockMoments.values()].filter((m) => m.ownerId === ownerId).sort((a, b) => b.createdAt - a.createdAt)
  }
  const snap = await getDocs(query(collection(db, 'sharedMoments'), where('ownerId', '==', ownerId)))
  return snap.docs.map((d) => d.data() as SharedMoment).sort((a, b) => b.createdAt - a.createdAt)
}

// A single array-contains query — everything this user was tagged in,
// whether they've accepted it yet or not.
export async function getSharedMomentsForParticipant(uid: string): Promise<SharedMoment[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockMoments.values()].filter((m) => m.participantIds.includes(uid)).sort((a, b) => b.createdAt - a.createdAt)
  }
  const snap = await getDocs(query(collection(db, 'sharedMoments'), where('participantIds', 'array-contains', uid)))
  return snap.docs.map((d) => d.data() as SharedMoment).sort((a, b) => b.createdAt - a.createdAt)
}

export async function acceptSharedMoment(id: string, uid: string): Promise<void> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    const moment = mockMoments.get(id)
    if (moment && !moment.acceptedParticipantIds.includes(uid)) {
      mockMoments.set(id, { ...moment, acceptedParticipantIds: [...moment.acceptedParticipantIds, uid] })
    }
    return
  }
  const snap = await getDoc(doc(db, 'sharedMoments', id))
  if (!snap.exists()) return
  const data = snap.data() as SharedMoment
  if (data.acceptedParticipantIds.includes(uid)) return
  await updateDoc(doc(db, 'sharedMoments', id), { acceptedParticipantIds: [...data.acceptedParticipantIds, uid] })
}

// Owner-only — deletes the shared moment, and cascades to every
// storyComment/storyReaction attached to it first (both are separate
// top-level collections keyed by sharedMomentId, not subcollections, so
// they'd otherwise be left as orphaned documents pointing at a moment that
// no longer exists).
export async function deleteSharedMoment(id: string): Promise<void> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    for (const [key, comment] of mockComments) if (comment.sharedMomentId === id) mockComments.delete(key)
    for (const [key, reaction] of mockReactions) if (reaction.sharedMomentId === id) mockReactions.delete(key)
    mockMoments.delete(id)
    return
  }
  const [comments, reactions] = await Promise.all([
    getDocs(query(collection(db, 'storyComments'), where('sharedMomentId', '==', id))),
    getDocs(query(collection(db, 'storyReactions'), where('sharedMomentId', '==', id))),
  ])
  await Promise.all([
    ...comments.docs.map((d) => deleteDoc(d.ref)),
    ...reactions.docs.map((d) => deleteDoc(d.ref)),
    deleteDoc(doc(db, 'sharedMoments', id)),
  ])
}

// Best-effort cleanup for a deleted Pour's shared copy (see
// hooks/useUserData.tsx deletePour/deleteBottles) — only ever called with
// the deleting user's own uid as ownerId, so this can never touch another
// user's SharedMoment even though the query itself has no owner filter
// built in; the ownerId check happens client-side before deleting. Never
// throws — an orphaned SharedMoment is a much smaller problem than a
// failed pour delete.
export async function deleteSharedMomentsForStory(storyId: string, ownerId: string): Promise<void> {
  await ensureSeeded()
  try {
    if (isMockAuthEnabled()) {
      for (const [key, moment] of mockMoments) {
        if (moment.storyId === storyId && moment.ownerId === ownerId) await deleteSharedMoment(key)
      }
      return
    }
    // A single equality filter — same "no composite index" discipline as
    // getRecommendationsForRecipient above; the ownerId check is applied
    // client-side rather than as a second `where` clause.
    const snap = await getDocs(query(collection(db, 'sharedMoments'), where('storyId', '==', storyId)))
    const owned = snap.docs.filter((d) => (d.data() as SharedMoment).ownerId === ownerId)
    await Promise.all(owned.map((d) => deleteSharedMoment(d.id)))
  } catch (err) {
    console.error('[sharedMoments] deleteSharedMomentsForStory failed', { storyId, ownerId, err })
  }
}

// --- Participant notes ("optionally add their own tasting impression" —
// never edits the owner's original story) ----------------------------------

export async function setParticipantNote(momentId: string, uid: string, note: string): Promise<void> {
  await ensureSeeded()
  const record: SharedMomentParticipantNote = { uid, note, updatedAt: now() }
  if (isMockAuthEnabled()) {
    mockParticipantNotes.set(`${momentId}:${uid}`, record)
    return
  }
  await setDoc(doc(db, 'sharedMoments', momentId, 'participantNotes', uid), record)
}

export async function getParticipantNotes(momentId: string): Promise<SharedMomentParticipantNote[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockParticipantNotes.entries()].filter(([key]) => key.startsWith(`${momentId}:`)).map(([, value]) => value)
  }
  const snap = await getDocs(collection(db, 'sharedMoments', momentId, 'participantNotes'))
  return snap.docs.map((d) => d.data() as SharedMomentParticipantNote)
}

// --- Reactions — whiskey-appropriate, one per person per story ------------

export async function setReaction(sharedMomentId: string, uid: string, type: StoryReactionType): Promise<void> {
  await ensureSeeded()
  const id = `${sharedMomentId}_${uid}`
  const reaction: StoryReaction = { id, sharedMomentId, uid, type, createdAt: now() }
  if (isMockAuthEnabled()) {
    mockReactions.set(id, reaction)
    return
  }
  await setDoc(doc(db, 'storyReactions', id), reaction)
}

export async function removeReaction(sharedMomentId: string, uid: string): Promise<void> {
  await ensureSeeded()
  const id = `${sharedMomentId}_${uid}`
  if (isMockAuthEnabled()) {
    mockReactions.delete(id)
    return
  }
  await deleteDoc(doc(db, 'storyReactions', id))
}

export async function getReactions(sharedMomentId: string): Promise<StoryReaction[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockReactions.values()].filter((r) => r.sharedMomentId === sharedMomentId)
  }
  const snap = await getDocs(query(collection(db, 'storyReactions'), where('sharedMomentId', '==', sharedMomentId)))
  return snap.docs.map((d) => d.data() as StoryReaction)
}

// --- Comments ---------------------------------------------------------------

export async function addComment(input: Omit<StoryComment, 'id' | 'createdAt'>): Promise<StoryComment> {
  await ensureSeeded()
  const id = isMockAuthEnabled() ? mockGenerateId('comment') : doc(collection(db, 'storyComments')).id
  const comment: StoryComment = { ...input, id, createdAt: now() }
  if (isMockAuthEnabled()) {
    mockComments.set(id, comment)
    return comment
  }
  await setDoc(doc(db, 'storyComments', id), comment)
  return comment
}

// Callable by the comment's own author OR the shared moment's owner
// (moderation) — enforced by firestore.rules, not here; this just deletes.
export async function deleteComment(id: string): Promise<void> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    mockComments.delete(id)
    return
  }
  await deleteDoc(doc(db, 'storyComments', id))
}

export async function getComments(sharedMomentId: string): Promise<StoryComment[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockComments.values()].filter((c) => c.sharedMomentId === sharedMomentId).sort((a, b) => a.createdAt - b.createdAt)
  }
  const snap = await getDocs(query(collection(db, 'storyComments'), where('sharedMomentId', '==', sharedMomentId)))
  return snap.docs.map((d) => d.data() as StoryComment).sort((a, b) => a.createdAt - b.createdAt)
}
