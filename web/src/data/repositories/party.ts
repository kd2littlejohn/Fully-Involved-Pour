// Blind Room Party Mode — client access. Every write is a call to the
// partyAction Cloud Function (functions/party/service.js); this module only
// reads directly from Firestore, through the read rules in firestore.rules.
import { httpsCallable } from 'firebase/functions'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, functions } from '../firebase'
import type {
  Party,
  PartyAdmin,
  PartyBallot,
  PartyBallotSummary,
  PartyCategory,
  PartyCategoryResults,
  PartyFormat,
  PartyGuest,
  PartyPreview,
  PartyRecap,
  PartyRosterEntry,
  PartySample,
  PartySampleScore,
  PartyScoringMode,
  PartySecrets,
  PartySettings,
  PartyTemplate,
  SavedTastingCategory,
  PartyBottle,
} from '../../features/party/types'

const partyActionCallable = httpsCallable<Record<string, unknown>, unknown>(functions, 'partyAction')

// The server's HttpsError messages are written for people ("Voting isn't
// open for this round."); fall back to a generic line for anything else.
export function partyErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const code = 'code' in err ? String((err as { code?: unknown }).code) : ''
    const message = 'message' in err ? String((err as { message?: unknown }).message) : ''
    if (code.includes('unavailable') || code.includes('internal') || code.includes('deadline')) {
      return 'We couldn’t reach the party right now. Check your connection and try again.'
    }
    if (message && !message.toLowerCase().startsWith('internal')) return message
  }
  return 'Something went wrong. Please try again.'
}

export async function callParty<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const result = await partyActionCallable({ action, ...data })
  return result.data as T
}

// --- Host setup -----------------------------------------------------------

export interface PartyDetailsInput {
  name: string
  description?: string
  eventDate?: string | null
  coverImageUrl?: string
  capacity?: number | null
}

export interface PartyCategoryInput {
  id?: string
  libraryId?: string | null
  name: string
  description?: string
  duplicateOf?: string
}

export interface PartySampleInput {
  bottle: PartyBottle
  label?: string
}

export function createParty(input: {
  details: PartyDetailsInput
  settings: PartySettings
  categories: PartyCategoryInput[]
  hostName: string
  hostTasting: boolean
  format: PartyFormat
}): Promise<{ partyId: string; joinCode: string; categories: { id: string; name: string }[] }> {
  return callParty('createParty', { ...input })
}

export function updateParty(
  partyId: string,
  patch: { details?: PartyDetailsInput; settings?: Partial<PartySettings>; recapNotes?: string; format?: PartyFormat },
): Promise<{ ok: true }> {
  return callParty('updateParty', { partyId, ...patch })
}

export function setPartyCategories(partyId: string, categories: PartyCategoryInput[]): Promise<{ categories: PartyCategory[] }> {
  return callParty('setCategories', { partyId, categories })
}

export function setPartySamples(
  partyId: string,
  categoryId: string,
  samples: PartySampleInput[],
  assignment: 'random' | 'manual',
): Promise<{ samples: PartySample[] }> {
  return callParty('setSamples', { partyId, categoryId, samples, assignment })
}

// "I'm tasting too" after creation. Off stops the host's ballots counting in
// rounds not yet revealed; on restores them.
export function setHostTasting(partyId: string, enabled: boolean): Promise<{ ok: true; hostTasting: boolean }> {
  return callParty('setHostTasting', { partyId, enabled })
}

// --- Bottle key and co-hosts -------------------------------------------------

export interface BottleKey {
  categories: PartySecrets['categories']
  // Rounds where this view marks the tasting host's ballot as not fully blind.
  flaggedCategoryIds: string[]
}

// The sample -> bottle mapping, for the host or a co-host. Always an explicit
// call (never a live listener): the server logs every view before reveal.
export function getBottleKey(partyId: string, purpose: 'key' | 'setup' = 'key'): Promise<BottleKey> {
  return callParty('getBottleKey', { partyId, confirm: true, purpose })
}

export function createCoHostInvite(partyId: string): Promise<{ token: string; expiresAt: number }> {
  return callParty('createCoHostInvite', { partyId })
}

export function acceptCoHost(partyId: string, token: string, name: string): Promise<{ partyId: string; alreadyCoHost: boolean }> {
  return callParty('acceptCoHost', { partyId, token, name })
}

export function removeCoHost(partyId: string, uid: string): Promise<{ ok: true }> {
  return callParty('removeCoHost', { partyId, uid })
}

export interface KeyAccessEntry {
  id: string
  actorUid: string
  role: 'host' | 'cohost'
  purpose: 'key' | 'setup'
  at: number
  flaggedCategoryIds: string[]
}

// Every bottle-key view before reveal (admins only; see firestore.rules).
export async function getKeyAccessLog(partyId: string): Promise<KeyAccessEntry[]> {
  const snap = await getDocs(query(collection(db, 'parties', partyId, 'audit'), where('type', '==', 'bottle-key-viewed')))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<KeyAccessEntry, 'id'>) }))
    .map((e) => ({ ...e, flaggedCategoryIds: e.flaggedCategoryIds ?? [] }))
    .sort((a, b) => b.at - a.at)
}

export function deleteParty(partyId: string): Promise<{ ok: true }> {
  return callParty('deleteParty', { partyId, confirm: true })
}

// --- Host: running the event ------------------------------------------------

export function setCategoryState(partyId: string, categoryId: string, to: PartyCategory['state']): Promise<{ state: string }> {
  return callParty('setCategoryState', { partyId, categoryId, to })
}

export function revealAllCategories(partyId: string): Promise<{ revealed: string[] }> {
  return callParty('revealAll', { partyId })
}

export function setCurrentCategory(partyId: string, categoryId: string): Promise<{ ok: true }> {
  return callParty('setCurrentCategory', { partyId, categoryId })
}

export function completeParty(partyId: string, notes?: string): Promise<{ ok: true }> {
  return callParty('completeParty', { partyId, ...(notes !== undefined ? { notes } : {}) })
}

export function setPartyInvite(partyId: string, active: boolean, expiresAt: number | null): Promise<{ ok: true }> {
  return callParty('setInvite', { partyId, active, expiresAt })
}

export function rotateJoinCode(partyId: string): Promise<{ joinCode: string }> {
  return callParty('rotateJoinCode', { partyId })
}

export function removePartyGuest(partyId: string, guestUid: string): Promise<{ ok: true }> {
  return callParty('removeGuest', { partyId, guestUid })
}

export function createDisplayLink(partyId: string): Promise<{ token: string; expiresAt: number }> {
  return callParty('createDisplayLink', { partyId })
}

export function revokeDisplays(partyId: string): Promise<{ ok: true }> {
  return callParty('revokeDisplays', { partyId })
}

// --- Host: ballots ----------------------------------------------------------

export interface PaperBallotInput {
  ballotId?: string
  ballotNumber: string
  nickname: string
  scores: Record<string, PartySampleScore>
  favoriteLabel: string | null
  predictionLabel?: string | null
}

export function savePaperBallot(
  partyId: string,
  categoryId: string,
  input: PaperBallotInput,
): Promise<{ ballotId: string; possibleDuplicateOf: { ballotId: string; nickname: string } | null }> {
  return callParty('savePaperBallot', { partyId, categoryId, mode: 'quick', ...input })
}

export function deletePaperBallot(partyId: string, ballotId: string): Promise<{ ok: true }> {
  return callParty('deletePaperBallot', { partyId, ballotId, confirm: true })
}

export function setBallotExcluded(partyId: string, ballotId: string, excluded: boolean, reason?: string): Promise<{ ok: true }> {
  return callParty('setBallotExcluded', { partyId, ballotId, excluded, reason })
}

export function listBallots(partyId: string, categoryId: string): Promise<{ ballots: PartyBallotSummary[] }> {
  return callParty('listBallots', { partyId, categoryId })
}

// --- Guests -------------------------------------------------------------------

export function previewParty(code: string): Promise<PartyPreview> {
  return callParty('previewParty', { code })
}

export function joinParty(
  code: string,
  nickname: string,
): Promise<{ partyId: string; nickname: string; recoveryCode?: string; alreadyJoined: boolean }> {
  return callParty('joinParty', { code, nickname })
}

export function recoverGuest(
  code: string,
  recoveryCode: string,
): Promise<{ partyId: string; recovered: true; nickname?: string; recoveryCode: string | null }> {
  return callParty('recoverGuest', { code, recoveryCode })
}

export function saveBallot(input: {
  partyId: string
  categoryId: string
  mode: PartyScoringMode
  scores: Record<string, PartySampleScore>
  favoriteLabel: string | null
  predictionLabel?: string | null
}): Promise<{
  ballotId: string
  scores: Record<string, PartySampleScore>
  favoriteLabel: string | null
  predictionLabel: string | null
  locked: boolean
}> {
  return callParty('saveBallot', { ...input })
}

export function redeemDisplay(partyId: string, token: string): Promise<{ partyId: string; expiresAt: number }> {
  return callParty('redeemDisplay', { partyId, token })
}

export function createClaimToken(): Promise<{ token: string; expiresAt: number }> {
  return callParty('createClaimToken')
}

export function claimGuest(token: string): Promise<{ claimed: string[]; skipped: string[] }> {
  return callParty('claimGuest', { token })
}

// --- Live reads ---------------------------------------------------------------

function watchDoc<T>(path: string[], onValue: (value: T | undefined) => void, onError?: (err: unknown) => void): Unsubscribe {
  const [first, ...rest] = path
  return onSnapshot(
    doc(db, first!, ...rest),
    (snap) => onValue(snap.exists() ? (snap.data() as T) : undefined),
    (err) => {
      console.error('[party] watch failed', { path: path.join('/'), code: (err as { code?: string }).code })
      onError?.(err)
    },
  )
}

export function watchParty(partyId: string, onValue: (party: Party | undefined) => void, onError?: (err: unknown) => void) {
  return watchDoc<Party>(['parties', partyId], onValue, onError)
}

export function watchMyGuest(partyId: string, uid: string, onValue: (guest: PartyGuest | undefined) => void, onError?: (err: unknown) => void) {
  return watchDoc<PartyGuest>(['parties', partyId, 'guests', uid], onValue, onError)
}

export function watchRecap(partyId: string, onValue: (recap: PartyRecap | undefined) => void, onError?: (err: unknown) => void) {
  return watchDoc<PartyRecap>(['parties', partyId, 'results', 'recap'], onValue, onError)
}

export function watchResults(
  partyId: string,
  onValue: (results: Record<string, PartyCategoryResults>) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'parties', partyId, 'results'),
    (snap) => {
      const out: Record<string, PartyCategoryResults> = {}
      for (const d of snap.docs) if (d.id !== 'recap') out[d.id] = d.data() as PartyCategoryResults
      onValue(out)
    },
    (err) => onError?.(err),
  )
}

export function watchMyBallots(
  partyId: string,
  uid: string,
  onValue: (ballots: PartyBallot[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'parties', partyId, 'ballots'), where('ownerUid', '==', uid)),
    (snap) => onValue(snap.docs.map((d) => d.data() as PartyBallot)),
    (err) => onError?.(err),
  )
}

export function watchGuests(partyId: string, onValue: (guests: PartyGuest[]) => void, onError?: (err: unknown) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'parties', partyId, 'guests'),
    (snap) => onValue(snap.docs.map((d) => d.data() as PartyGuest)),
    (err) => onError?.(err),
  )
}

// The shared "Who's Tasting" list. Every party member may read it.
export function watchRoster(
  partyId: string,
  onValue: (entries: PartyRosterEntry[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'parties', partyId, 'roster'),
    (snap) => onValue(snap.docs.map((d) => d.data() as PartyRosterEntry)),
    (err) => onError?.(err),
  )
}

// Admins only: builds the roster for a party created before it existed.
export function syncRoster(partyId: string): Promise<{ count: number }> {
  return callParty('syncRoster', { partyId })
}

// The caller's own admin record for a party (host / co-host), or none.
export function watchMyAdmin(
  partyId: string,
  uid: string,
  onValue: (admin: PartyAdmin | undefined) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return watchDoc<PartyAdmin>(['parties', partyId, 'admins', uid], onValue, onError)
}

// Everyone who runs the party. Readable by its admins only.
export function watchAdmins(partyId: string, onValue: (admins: PartyAdmin[]) => void, onError?: (err: unknown) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'parties', partyId, 'admins'),
    (snap) => onValue(snap.docs.map((d) => d.data() as PartyAdmin)),
    (err) => onError?.(err),
  )
}

// Moves an older party's admin uids off its guest-readable document. The
// server does this on any party action; this lets a page ask for it.
export function migrateParty(partyId: string): Promise<{ ok: true }> {
  return callParty('migrateParty', { partyId })
}

// --- Party lists ----------------------------------------------------------------

// Parties this account runs, as host or co-host: found through its own
// protected admin records (the party documents carry no admin uids).
export interface HostedParty extends Party {
  myRole: PartyAdmin['role']
}

export async function getHostedParties(uid: string): Promise<HostedParty[]> {
  const records = await getDocs(query(collectionGroup(db, 'admins'), where('uid', '==', uid)))
  const parties: HostedParty[] = []
  for (const record of records.docs) {
    const partyId = record.ref.parent.parent?.id
    if (!partyId) continue
    try {
      const snap = await getDoc(doc(db, 'parties', partyId))
      if (snap.exists()) parties.push({ ...(snap.data() as Party), myRole: (record.data() as PartyAdmin).role })
    } catch (err) {
      console.error('[party] could not load hosted party', { partyId, err })
    }
  }
  return parties.sort((a, b) => b.createdAt - a.createdAt)
}

// Parties this identity joined as a guest (excluding ones it hosts).
export async function getAttendedParties(uid: string): Promise<Party[]> {
  const snap = await getDocs(query(collectionGroup(db, 'guests'), where('uid', '==', uid)))
  const parties: Party[] = []
  for (const guestDoc of snap.docs) {
    const partyId = guestDoc.ref.parent.parent?.id
    if (!partyId || (guestDoc.data() as PartyGuest).revoked) continue
    try {
      const partySnap = await getDoc(doc(db, 'parties', partyId))
      // The host's own tasting record is a guest record too; their party
      // is already listed among the parties they run.
      if (partySnap.exists() && !(guestDoc.data() as PartyGuest).isHost) parties.push(partySnap.data() as Party)
    } catch (err) {
      console.error('[party] could not load attended party', { partyId, err })
    }
  }
  return parties.sort((a, b) => b.createdAt - a.createdAt)
}

// --- Saved categories and setups (owner-only, direct writes) --------------------

export async function getSavedCategories(uid: string): Promise<SavedTastingCategory[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'partyCategories'))
  return snap.docs.map((d) => ({ ...(d.data() as Omit<SavedTastingCategory, 'id'>), id: d.id })).sort((a, b) => a.name.localeCompare(b.name))
}

export async function saveCustomCategory(
  uid: string,
  input: { id?: string; name: string; description: string },
): Promise<SavedTastingCategory> {
  const ref = input.id ? doc(db, 'users', uid, 'partyCategories', input.id) : doc(collection(db, 'users', uid, 'partyCategories'))
  const now = Date.now()
  const existing = input.id ? await getDoc(ref) : undefined
  const record = {
    name: input.name.trim().slice(0, 80),
    description: input.description.trim().slice(0, 400),
    createdAt: existing?.exists() ? (existing.data().createdAt as number) : now,
    updatedAt: now,
  }
  await setDoc(ref, record)
  return { ...record, id: ref.id }
}

export async function deleteCustomCategory(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'partyCategories', id))
}

export async function getPartyTemplates(uid: string): Promise<PartyTemplate[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'partyTemplates'))
  return snap.docs.map((d) => ({ ...(d.data() as Omit<PartyTemplate, 'id'>), id: d.id })).sort((a, b) => b.createdAt - a.createdAt)
}

export async function savePartyTemplate(uid: string, name: string, categories: PartyTemplate['categories']): Promise<PartyTemplate> {
  const ref = doc(collection(db, 'users', uid, 'partyTemplates'))
  const record = { name: name.trim().slice(0, 80), categories: categories.slice(0, 24), createdAt: Date.now() }
  await setDoc(ref, record)
  return { ...record, id: ref.id }
}

export async function deletePartyTemplate(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'partyTemplates', id))
}

// --- AXE (optional, post-reveal) -------------------------------------------

export type PartyAxeQuestion = 'room-preference' | 'my-palate' | 'style-differences' | 'try-next'

const askSommelierCallable = httpsCallable<Record<string, unknown>, { reply: string }>(functions, 'askSommelier')

export async function askPartyAxe(partyId: string, categoryId: string, question: PartyAxeQuestion): Promise<string> {
  const result = await askSommelierCallable({ mode: 'party-insight', partyId, categoryId, question })
  return result.data.reply
}
