import { collection, doc, getDoc, getDocs, collectionGroup, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type {
  BlindFinalRanking,
  BlindKnowledgeMode,
  BlindParticipant,
  BlindRoom,
  BlindRoomSecrets,
  BlindSecretPour,
  BlindSessionType,
  BlindTastingResponse,
} from '../types'

export class RoomCodeInvalidError extends Error {}

// Unambiguous alphabet — no O/0 or I/1 confusion when someone reads a code
// aloud or copies it by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const MAX_CODE_ATTEMPTS = 8

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

function defaultRoomName(): string {
  return `Blind — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export interface CreateBlindRoomInput {
  hostUid: string
  hostUsername: string
  name?: string
  sessionType: BlindSessionType
  knowledgeMode: BlindKnowledgeMode
  pourCount: number
  knownLineup?: string[]
  deadline?: number
  pours: BlindSecretPour[]
}

// --- Mock-mode fallback -----------------------------------------------
// Blind Room is inherently multi-user; the dev fixture session only ever
// simulates one signed-in user, so this can't fully exercise a second
// participant joining. It still needs to not crash dev-mode browsing —
// same in-memory-Map fallback pattern as features/faceoff/repository.ts.
const mockRooms = new Map<string, BlindRoom>()
const mockParticipants = new Map<string, Map<string, BlindParticipant>>()
const mockCodes = new Map<string, string>()
const mockSecrets = new Map<string, BlindRoomSecrets>()
// Keyed by `${roomId}:${uid}` -> pourLabel -> response, mirroring the real
// per-participant subcollection shape closely enough for dev-mode UI work.
const mockResponses = new Map<string, Map<string, BlindTastingResponse>>()
// Keyed by `${roomId}:${uid}` -> the participant's one final ranking doc.
const mockRankings = new Map<string, BlindFinalRanking>()

function responseKey(roomId: string, uid: string): string {
  return `${roomId}:${uid}`
}

function mockGenerateId(): string {
  return `mock-room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// --- Reads ---------------------------------------------------------------

export async function getBlindRoom(roomId: string): Promise<BlindRoom | undefined> {
  if (isMockAuthEnabled()) return mockRooms.get(roomId)
  const snap = await getDoc(doc(db, 'blindRooms', roomId))
  return snap.exists() ? (snap.data() as BlindRoom) : undefined
}

export async function getBlindRoomByCode(code: string): Promise<BlindRoom | undefined> {
  const normalized = code.trim().toUpperCase()
  if (isMockAuthEnabled()) {
    const roomId = mockCodes.get(normalized)
    return roomId ? mockRooms.get(roomId) : undefined
  }
  const codeSnap = await getDoc(doc(db, 'blindRoomCodes', normalized))
  if (!codeSnap.exists()) return undefined
  const { roomId } = codeSnap.data() as { roomId: string }
  return getBlindRoom(roomId)
}

export async function getParticipants(roomId: string): Promise<BlindParticipant[]> {
  if (isMockAuthEnabled()) return [...(mockParticipants.get(roomId)?.values() ?? [])]
  const snap = await getDocs(collection(db, 'blindRooms', roomId, 'participants'))
  return snap.docs.map((d) => d.data() as BlindParticipant)
}

export async function getParticipant(roomId: string, uid: string): Promise<BlindParticipant | undefined> {
  if (isMockAuthEnabled()) return mockParticipants.get(roomId)?.get(uid)
  const snap = await getDoc(doc(db, 'blindRooms', roomId, 'participants', uid))
  return snap.exists() ? (snap.data() as BlindParticipant) : undefined
}

// Every blind room this user is (or was) a participant in, across all
// rooms — backs the Landing page's Active/Recent Blinds lists. Requires a
// Firestore collection-group query over every `participants` subcollection,
// filtered to this user's own uid (see firestore.rules — the per-document
// participant read rule already permits exactly this: every matched
// document has uid == the querying user's own uid).
export async function getMyBlindRooms(uid: string): Promise<{ room: BlindRoom; participant: BlindParticipant }[]> {
  if (isMockAuthEnabled()) {
    const results: { room: BlindRoom; participant: BlindParticipant }[] = []
    for (const [roomId, participants] of mockParticipants) {
      const mine = participants.get(uid)
      const room = mockRooms.get(roomId)
      if (mine && room) results.push({ room, participant: mine })
    }
    return results
  }

  const snap = await getDocs(query(collectionGroup(db, 'participants'), where('uid', '==', uid)))
  const results: { room: BlindRoom; participant: BlindParticipant }[] = []
  for (const participantDoc of snap.docs) {
    const roomId = participantDoc.ref.parent.parent?.id
    if (!roomId) continue
    const room = await getBlindRoom(roomId)
    if (room) results.push({ room, participant: participantDoc.data() as BlindParticipant })
  }
  return results
}

export async function getBlindRoomSecrets(roomId: string): Promise<BlindRoomSecrets | undefined> {
  if (isMockAuthEnabled()) return mockSecrets.get(roomId)
  const snap = await getDoc(doc(db, 'blindRoomSecrets', roomId))
  return snap.exists() ? (snap.data() as BlindRoomSecrets) : undefined
}

// A participant's own tasting responses across every pour in the room —
// never another participant's (see firestore.rules; this only ever
// resolves for the currently signed-in uid, by construction of who's
// allowed to read the path).
export async function getTastingResponses(roomId: string, uid: string): Promise<BlindTastingResponse[]> {
  if (isMockAuthEnabled()) return [...(mockResponses.get(responseKey(roomId, uid))?.values() ?? [])]
  const snap = await getDocs(collection(db, 'blindRooms', roomId, 'participants', uid, 'responses'))
  return snap.docs.map((d) => d.data() as BlindTastingResponse)
}

export async function getFinalRanking(roomId: string, uid: string): Promise<BlindFinalRanking | undefined> {
  if (isMockAuthEnabled()) return mockRankings.get(responseKey(roomId, uid))
  const snap = await getDoc(doc(db, 'blindRooms', roomId, 'participants', uid, 'ranking', 'final'))
  return snap.exists() ? (snap.data() as BlindFinalRanking) : undefined
}

// Fetches every named participant's tasting responses in one call — only
// ever resolves real data once the room is revealed (firestore.rules blocks
// each individual read otherwise), which is the only time this is called;
// powers the reveal/compare-results screen.
export async function getAllParticipantResponses(
  roomId: string,
  uids: string[],
): Promise<Record<string, BlindTastingResponse[]>> {
  const entries = await Promise.all(uids.map(async (uid) => [uid, await getTastingResponses(roomId, uid)] as const))
  return Object.fromEntries(entries)
}

export async function getAllFinalRankings(
  roomId: string,
  uids: string[],
): Promise<Record<string, BlindFinalRanking | undefined>> {
  const entries = await Promise.all(uids.map(async (uid) => [uid, await getFinalRanking(roomId, uid)] as const))
  return Object.fromEntries(entries)
}

export interface BottleBlindHistoryEntry {
  room: BlindRoom
  pour: BlindSecretPour
  myResponse?: BlindTastingResponse
}

// Every revealed Blind this bottle appeared in for this user, newest
// first — powers Bottle Details' Blind History. Only ever looks at
// revealed rooms: blindRoomSecrets is unreadable pre-reveal for a
// participant anyway (see firestore.rules), and a host peeking at their
// own unrevealed room here would spoil their own upcoming reveal.
export async function getBottleBlindHistory(uid: string, bottleId: string): Promise<BottleBlindHistoryEntry[]> {
  const myRooms = await getMyBlindRooms(uid)
  const revealed = myRooms.filter(({ room }) => room.state === 'revealed')

  const entries: BottleBlindHistoryEntry[] = []
  for (const { room } of revealed) {
    const secrets = await getBlindRoomSecrets(room.id)
    const pour = secrets?.pours.find((p) => p.bottleId === bottleId)
    if (!pour) continue
    const responses = await getTastingResponses(room.id, uid)
    entries.push({ room, pour, myResponse: responses.find((r) => r.pourLabel === pour.label) })
  }

  return entries.sort((a, b) => (b.room.revealedAt ?? 0) - (a.room.revealedAt ?? 0))
}

// --- Writes ----------------------------------------------------------------

// Deliberately sequential, not a single Firestore transaction: the
// blindRoomCodes and blindRoomSecrets security rules both validate against
// the room doc via get(), which (inside a transaction) can only see
// already-committed state — not other writes queued in the same
// transaction. Creating the room first and letting it commit before the
// dependent writes keeps every step's rule check straightforward, at the
// cost of a room very rarely being left without a code/secrets doc if a
// later step fails (acceptable for Milestone 1; not resumable yet).
export async function createBlindRoom(input: CreateBlindRoomInput): Promise<BlindRoom> {
  const now = Date.now()
  const roomId = isMockAuthEnabled() ? mockGenerateId() : doc(collection(db, 'blindRooms')).id
  const code = await findAvailableRoomCode()

  // A solo room has no one else to wait for — it skips the lobby/ready-up
  // steps entirely and starts already 'active', same end state a group room
  // reaches once its host taps Start Blind.
  const isSolo = input.sessionType === 'solo'

  const room: BlindRoom = {
    id: roomId,
    code,
    name: input.name?.trim() || defaultRoomName(),
    hostUid: input.hostUid,
    hostUsername: input.hostUsername,
    sessionType: input.sessionType,
    knowledgeMode: input.knowledgeMode,
    pourCount: input.pourCount,
    ...(input.knowledgeMode === 'single' && input.knownLineup ? { knownLineup: shuffled(input.knownLineup) } : {}),
    ...(input.sessionType === 'challenge' && input.deadline ? { deadline: input.deadline } : {}),
    state: isSolo ? 'active' : 'lobby',
    createdAt: now,
    ...(isSolo ? { startedAt: now } : {}),
    participantCount: 1,
  }

  const hostParticipant: BlindParticipant = {
    uid: input.hostUid,
    username: input.hostUsername,
    isHost: true,
    status: 'ready',
    joinedAt: now,
    readyAt: now,
  }

  const secrets: BlindRoomSecrets = { roomId, pours: input.pours }

  if (isMockAuthEnabled()) {
    mockRooms.set(roomId, room)
    mockParticipants.set(roomId, new Map([[hostParticipant.uid, hostParticipant]]))
    mockCodes.set(code, roomId)
    mockSecrets.set(roomId, secrets)
    return room
  }

  // Sequential, not a single transaction: the code and secrets docs' rules
  // both check the room's hostUid via get(), which — inside a transaction —
  // only sees already-committed state, not other writes queued in the same
  // transaction. Writing the room first and letting it commit keeps every
  // later step's rule check straightforward.
  await setDoc(doc(db, 'blindRooms', roomId), room)
  await setDoc(doc(db, 'blindRooms', roomId, 'participants', hostParticipant.uid), hostParticipant)
  await setDoc(doc(db, 'blindRoomCodes', code), { roomId, createdAt: now })
  await setDoc(doc(db, 'blindRoomSecrets', roomId), secrets)

  return room
}

// Finds a room code that's currently free. A small race window exists
// between this check and the room actually being created (another host
// could claim the same code in between) — acceptable for Milestone 1, same
// level of rigor as the existing claimUsername check-then-set pattern. A
// genuine collision surfaces as a write failure the user can retry by
// creating the room again, rather than silently overwriting someone else's
// code (the security rules block that outright — see firestore.rules).
async function findAvailableRoomCode(): Promise<string> {
  if (isMockAuthEnabled()) {
    let code = generateRoomCode()
    while (mockCodes.has(code)) code = generateRoomCode()
    return code
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode()
    const existing = await getDoc(doc(db, 'blindRoomCodes', code))
    if (!existing.exists()) return code
  }
  throw new Error('Could not generate a unique room code. Please try again.')
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

export async function joinBlindRoomByCode(code: string, uid: string, username: string): Promise<BlindRoom> {
  const room = await getBlindRoomByCode(code)
  if (!room) throw new RoomCodeInvalidError('That room code doesn’t match an active Blind Room.')

  const existing = await getParticipant(room.id, uid)
  if (existing) return room

  const participant: BlindParticipant = { uid, username, isHost: false, status: 'joined', joinedAt: Date.now() }

  if (isMockAuthEnabled()) {
    const participants = mockParticipants.get(room.id) ?? new Map()
    participants.set(uid, participant)
    mockParticipants.set(room.id, participants)
    room.participantCount = participants.size
    mockRooms.set(room.id, room)
    return room
  }

  await setDoc(doc(db, 'blindRooms', room.id, 'participants', uid), participant)
  await updateDoc(doc(db, 'blindRooms', room.id), { participantCount: room.participantCount + 1 })
  return { ...room, participantCount: room.participantCount + 1 }
}

export async function setParticipantReady(roomId: string, uid: string, ready: boolean): Promise<void> {
  const patch: Partial<BlindParticipant> = ready ? { status: 'ready', readyAt: Date.now() } : { status: 'joined' }
  if (isMockAuthEnabled()) {
    const participants = mockParticipants.get(roomId)
    const current = participants?.get(uid)
    if (participants && current) participants.set(uid, { ...current, ...patch })
    return
  }
  await updateDoc(doc(db, 'blindRooms', roomId, 'participants', uid), patch)
}

export async function startBlind(roomId: string): Promise<void> {
  const patch = { state: 'active' as const, startedAt: Date.now() }
  if (isMockAuthEnabled()) {
    const room = mockRooms.get(roomId)
    if (room) mockRooms.set(roomId, { ...room, ...patch })
    return
  }
  await updateDoc(doc(db, 'blindRooms', roomId), patch)
}

// First entry into the tasting flow for this participant — records when
// they actually started (distinct from `readyAt`) and flips their status
// so the host/lobby can see "tasting" vs merely "ready". Safe to call
// repeatedly (e.g. every time the tasting page mounts); only the first
// call's timestamp sticks in the real backend since callers only read this
// once up front, but it's still idempotent enough not to matter either way.
export async function markTastingStarted(roomId: string, uid: string): Promise<void> {
  const patch: Partial<BlindParticipant> = { status: 'tasting', startedTastingAt: Date.now() }
  if (isMockAuthEnabled()) {
    const participants = mockParticipants.get(roomId)
    const current = participants?.get(uid)
    if (participants && current && current.status !== 'completed') participants.set(uid, { ...current, ...patch })
    return
  }
  await updateDoc(doc(db, 'blindRooms', roomId, 'participants', uid), patch)
}

export async function markTastingCompleted(roomId: string, uid: string): Promise<void> {
  const patch: Partial<BlindParticipant> = { status: 'completed', completedAt: Date.now() }
  if (isMockAuthEnabled()) {
    const participants = mockParticipants.get(roomId)
    const current = participants?.get(uid)
    if (participants && current) participants.set(uid, { ...current, ...patch })
    return
  }
  await updateDoc(doc(db, 'blindRooms', roomId, 'participants', uid), patch)
}

// Autosave — called on every field change (debounced by the caller), so
// this stays a plain merge write rather than anything fancier. Silently
// resolves for an already-locked response instead of throwing: an autosave
// firing just after the user hits "Lock" is a normal race, not an error the
// UI needs to surface (the security rule blocks the write either way, so no
// data is ever lost or corrupted — the locked value simply wins).
export async function saveTastingResponse(
  roomId: string,
  uid: string,
  pourLabel: string,
  patch: Partial<Omit<BlindTastingResponse, 'pourLabel' | 'status' | 'lockedAt'>>,
): Promise<void> {
  if (isMockAuthEnabled()) {
    const key = responseKey(roomId, uid)
    const responses = mockResponses.get(key) ?? new Map<string, BlindTastingResponse>()
    const current = responses.get(pourLabel)
    if (current?.status === 'locked') return
    responses.set(pourLabel, { ...current, ...patch, pourLabel, status: 'in-progress', updatedAt: Date.now() })
    mockResponses.set(key, responses)
    return
  }

  try {
    await setDoc(
      doc(db, 'blindRooms', roomId, 'participants', uid, 'responses', pourLabel),
      { ...patch, pourLabel, status: 'in-progress', updatedAt: Date.now() },
      { merge: true },
    )
  } catch {
    // A locked response rejects this write via firestore.rules — treated as
    // a no-op, not a user-facing error (see comment above).
  }
}

export async function lockTastingResponse(roomId: string, uid: string, pourLabel: string): Promise<void> {
  const now = Date.now()
  if (isMockAuthEnabled()) {
    const key = responseKey(roomId, uid)
    const responses = mockResponses.get(key) ?? new Map<string, BlindTastingResponse>()
    const current = responses.get(pourLabel)
    responses.set(pourLabel, {
      ...current,
      pourLabel,
      status: 'locked',
      updatedAt: now,
      lockedAt: now,
    })
    mockResponses.set(key, responses)
    return
  }
  await setDoc(
    doc(db, 'blindRooms', roomId, 'participants', uid, 'responses', pourLabel),
    { pourLabel, status: 'locked', updatedAt: now, lockedAt: now },
    { merge: true },
  )
}

// Autosave for the final-ranking step — same "silently no-op past lock"
// contract as saveTastingResponse above.
export async function saveFinalRanking(roomId: string, uid: string, order: string[]): Promise<void> {
  if (isMockAuthEnabled()) {
    const key = responseKey(roomId, uid)
    const current = mockRankings.get(key)
    if (current?.status === 'locked') return
    mockRankings.set(key, { order, status: 'in-progress', updatedAt: Date.now() })
    return
  }

  try {
    await setDoc(
      doc(db, 'blindRooms', roomId, 'participants', uid, 'ranking', 'final'),
      { order, status: 'in-progress', updatedAt: Date.now() },
      { merge: true },
    )
  } catch {
    // A locked ranking rejects this write via firestore.rules — see the
    // matching comment on saveTastingResponse above.
  }
}

export async function lockFinalRanking(roomId: string, uid: string, order: string[]): Promise<void> {
  const now = Date.now()
  if (isMockAuthEnabled()) {
    mockRankings.set(responseKey(roomId, uid), { order, status: 'locked', updatedAt: now, lockedAt: now })
    return
  }
  await setDoc(
    doc(db, 'blindRooms', roomId, 'participants', uid, 'ranking', 'final'),
    { order, status: 'locked', updatedAt: now, lockedAt: now },
    { merge: true },
  )
}

// Host-only (enforced by firestore.rules, same rule as any other room-doc
// update) — flips the one field every hidden-data read rule in this file
// gates on. A single atomic write to a single document, so there's no
// intermediate state where secrets are readable but the room doesn't yet
// say 'revealed', or vice versa; see the isBlindRevealed comment in
// firestore.rules for why this doesn't need a Cloud Function.
export async function revealBlind(roomId: string): Promise<void> {
  const patch = { state: 'revealed' as const, revealedAt: Date.now() }
  if (isMockAuthEnabled()) {
    const room = mockRooms.get(roomId)
    if (room) mockRooms.set(roomId, { ...room, ...patch })
    return
  }
  await updateDoc(doc(db, 'blindRooms', roomId), patch)
}
