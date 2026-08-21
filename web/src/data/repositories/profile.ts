import { collection, doc, endAt, getDoc, getDocs, orderBy, query, setDoc, startAt } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { Profile, UsernameRecord } from '../types'

// profiles/{uid} — same public doc username.ts already writes `username`
// into. Public read (see firestore.rules), owner-only write.
//
// In mock mode, resolves against MOCK_FRIEND_PROFILES instead of real
// Firestore — needed because useFriends/useFriendProfile call this for
// OTHER users' uids (seeded friends), not just the signed-in user's own
// (whose mock profile useUserData.tsx already builds locally without ever
// calling this function).
export async function fetchProfile(uid: string): Promise<Profile | undefined> {
  if (isMockAuthEnabled()) {
    const { MOCK_FRIEND_PROFILES } = await import('../mockSocialData')
    const match = MOCK_FRIEND_PROFILES.find((p) => p.uid === uid)
    return match
      ? { username: match.username, displayName: match.displayName, location: match.location, whiskeyIdentityTags: match.whiskeyIdentityTags }
      : undefined
  }
  const snap = await getDoc(doc(db, 'profiles', uid))
  return snap.exists() ? (snap.data() as Profile) : undefined
}

// Shared by both the searchable-fields written on save (below) and the
// query normalization in searchProfiles — a leading '@' is stripped so
// "@kevin", "kevin", and "Kevin" all normalize identically, matching how
// people actually type a username with or without the sigil.
function normalizeForSearch(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

// Keeps normalizedDisplayName in sync whenever displayName changes — see
// searchProfiles below, which reads this field rather than normalizing at
// query time (Firestore can only prefix-range-query a literal field).
export async function saveProfile(uid: string, patch: Partial<Omit<Profile, 'username'>>): Promise<void> {
  const fullPatch = {
    ...patch,
    ...(patch.displayName !== undefined ? { normalizedDisplayName: normalizeForSearch(patch.displayName) } : {}),
  }
  await setDoc(doc(db, 'profiles', uid), fullPatch, { merge: true })
}

export interface ProfileSearchResult extends Profile {
  uid: string
}

const SEARCH_LIMIT = 20

// Matches by @username or display name prefix — never by email (Profile
// has no email field at all). profiles/{uid} is already public-read for a
// single-doc get (see firestore.rules); this only additionally permits
// prefix-range LIST queries against the same already-public fields, not
// any new private data.
//
// prefixEnd below appends the standard Firestore prefix-range sentinel
// character (a very-high-codepoint character that renders invisibly in
// most editors/terminals) to q, so do not be alarmed that nothing is
// visibly appended to it in this file. startAt(q).endAt(prefixEnd) is
// what makes this a "starts with q" range instead of an exact-match one.
export async function searchProfiles(rawQuery: string, excludeUid?: string): Promise<ProfileSearchResult[]> {
  const q = normalizeForSearch(rawQuery)
  if (!q) return []

  if (isMockAuthEnabled()) {
    const { MOCK_FRIEND_PROFILES } = await import('../mockSocialData')
    return MOCK_FRIEND_PROFILES.filter(
      (p) => p.uid !== excludeUid && (p.username.toLowerCase().startsWith(q) || p.displayName.toLowerCase().startsWith(q)),
    ).map((p) => ({ uid: p.uid, username: p.username, displayName: p.displayName, location: p.location, whiskeyIdentityTags: p.whiskeyIdentityTags }))
  }

  const profiles = collection(db, 'profiles')
  const prefixEnd = `${q}`
  let byUsername
  let byDisplayName
  try {
    ;[byUsername, byDisplayName] = await Promise.all([
      getDocs(query(profiles, orderBy('normalizedUsername'), startAt(q), endAt(prefixEnd))),
      getDocs(query(profiles, orderBy('normalizedDisplayName'), startAt(q), endAt(prefixEnd))),
    ])
  } catch (err) {
    // Dev-only — never a production log, and never anything beyond the
    // already-public normalized query string and a generic error code/
    // message (see isMockAuthEnabled's own DEV-elimination comment in
    // devMode.ts for why this branch never ships).
    if (import.meta.env.DEV) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: unknown }).code : undefined
      console.debug('[searchProfiles] Firestore error', {
        normalizedQuery: q,
        collection: 'profiles',
        fields: ['normalizedUsername', 'normalizedDisplayName'],
        code,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    throw err
  }

  const results = new Map<string, ProfileSearchResult>()
  for (const snap of [byUsername, byDisplayName]) {
    for (const docSnap of snap.docs) {
      if (docSnap.id === excludeUid) continue
      results.set(docSnap.id, { uid: docSnap.id, ...(docSnap.data() as Profile) })
    }
  }

  if (import.meta.env.DEV) {
    console.debug('[searchProfiles]', {
      normalizedQuery: q,
      collection: 'profiles',
      fields: ['normalizedUsername', 'normalizedDisplayName'],
      resultCount: results.size,
    })
  }

  return [...results.values()].slice(0, SEARCH_LIMIT)
}

export interface EnsureSearchableProfileHints {
  preferredUsername?: string
  displayName?: string
  photoURL?: string
}

function slugifyUsername(base: string): string {
  const cleaned = normalizeForSearch(base)
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || 'friend'
}

const MAX_USERNAME_ATTEMPTS = 25

// Idempotent, safe to call on every load. Takes the profile the caller
// already fetched (avoids a second, redundant read of the same document)
// and returns the profile to actually use — either the original, untouched,
// or the newly created/repaired one. Handles two distinct cases, both of
// which leave an account unfindable by Friend Search until fixed:
// (1) no profile at all — "brand-new signup" (called once auth resolves,
// before the user has ever touched Edit Profile) and "backfill for an
// account that predates this searchable-profile system" are the same fix
// here; and (2) a profile that exists but is missing or stale on
// normalizedUsername/normalizedDisplayName specifically — an account whose
// username/displayName predates those fields, or whose claim write only
// partially succeeded, can have a perfectly real profile that search still
// can't find them through. See useUserData.tsx's profile effect for where
// this gets called from. For case (1), prefers the account's
// already-chosen private username (userDoc.username, if any) over deriving
// a fresh one from the Google display name, so a returning user keeps
// whatever they're already known as elsewhere.
export async function ensureSearchableProfile(
  uid: string,
  existingProfile: Profile | undefined,
  hints: EnsureSearchableProfileHints,
): Promise<Profile | undefined> {
  if (isMockAuthEnabled()) return existingProfile

  if (existingProfile) {
    const patch: Partial<Profile> = {}
    if (existingProfile.username && existingProfile.normalizedUsername !== normalizeForSearch(existingProfile.username)) {
      patch.normalizedUsername = normalizeForSearch(existingProfile.username)
    }
    if (
      existingProfile.displayName &&
      existingProfile.normalizedDisplayName !== normalizeForSearch(existingProfile.displayName)
    ) {
      patch.normalizedDisplayName = normalizeForSearch(existingProfile.displayName)
    }
    if (Object.keys(patch).length === 0) return existingProfile
    await setDoc(doc(db, 'profiles', uid), patch, { merge: true })
    return { ...existingProfile, ...patch }
  }

  const base = slugifyUsername(hints.preferredUsername || hints.displayName || `friend_${uid.slice(0, 6)}`)
  const displayName = hints.displayName
  const normalizedDisplayName = displayName ? normalizeForSearch(displayName) : undefined

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`
    const usernameRef = doc(db, 'usernames', candidate)
    try {
      const usernameSnap = await getDoc(usernameRef)
      if (usernameSnap.exists() && (usernameSnap.data() as UsernameRecord).uid !== uid) continue

      const newProfile: Profile = {
        username: candidate,
        normalizedUsername: candidate,
        ...(displayName ? { displayName, normalizedDisplayName } : {}),
        ...(hints.photoURL ? { photoURL: hints.photoURL } : {}),
      }
      await Promise.all([setDoc(usernameRef, { uid, username: candidate }), setDoc(doc(db, 'profiles', uid), newProfile, { merge: true })])
      return newProfile
    } catch (err) {
      console.error('ensureSearchableProfile: attempt failed', { uid, candidate, err })
    }
  }
  console.error('ensureSearchableProfile: exhausted username attempts', { uid })
  return undefined
}
