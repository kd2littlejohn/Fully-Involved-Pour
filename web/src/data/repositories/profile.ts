import { collection, doc, endAt, getDoc, getDocs, orderBy, query, setDoc, startAt } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { Profile } from '../types'

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

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase()
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
  const [byUsername, byDisplayName] = await Promise.all([
    getDocs(query(profiles, orderBy('normalizedUsername'), startAt(q), endAt(`${q}`))),
    getDocs(query(profiles, orderBy('normalizedDisplayName'), startAt(q), endAt(`${q}`))),
  ])

  const results = new Map<string, ProfileSearchResult>()
  for (const snap of [byUsername, byDisplayName]) {
    for (const docSnap of snap.docs) {
      if (docSnap.id === excludeUid) continue
      results.set(docSnap.id, { uid: docSnap.id, ...(docSnap.data() as Profile) })
    }
  }
  return [...results.values()].slice(0, SEARCH_LIMIT)
}
