import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { UsernameRecord } from '../types'

export class UsernameTakenError extends Error {}

// Stripping a leading '@' here (not just in search — see profile.ts
// normalizeForSearch) means a user who types "@kevin" as the username
// they want to claim ends up with the same normalized form ("kevin") that
// search will look for, rather than literally claiming "@kevin".
function normalize(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase()
}

// Powers profile-by-username routes (e.g. /friends/u/:username, and "Share
// Profile" links) — usernames/{username} is public-read (see
// firestore.rules), so this never needs the caller to already know a uid.
export async function resolveUsername(username: string): Promise<string | undefined> {
  const normalized = normalize(username)
  if (isMockAuthEnabled()) {
    const { MOCK_FRIEND_PROFILES } = await import('../mockSocialData')
    return MOCK_FRIEND_PROFILES.find((p) => p.username.toLowerCase() === normalized)?.uid
  }
  const snap = await getDoc(doc(db, 'usernames', normalized))
  return snap.exists() ? (snap.data() as UsernameRecord).uid : undefined
}

// usernames/{normalizedUsername} and profiles/{uid} — matches the existing
// Firestore schema exactly (uniqueness registry + public lookup doc).
export async function claimUsername(uid: string, username: string): Promise<void> {
  const normalized = normalize(username)
  const usernameRef = doc(db, 'usernames', normalized)
  const existing = await getDoc(usernameRef)

  if (existing.exists() && existing.data().uid !== uid) {
    throw new UsernameTakenError('That username is already taken.')
  }

  await Promise.all([
    setDoc(usernameRef, { uid, username }),
    // merge:true — profiles/{uid} also holds displayName/bio/location/
    // photoURL (see data/repositories/profile.ts); a plain setDoc here would
    // silently wipe those fields whenever a username is (re)claimed.
    // normalizedUsername mirrors `normalized` for Friend search's
    // prefix-range query (see profile.ts searchProfiles) — Firestore can't
    // normalize a stored field at query time.
    setDoc(doc(db, 'profiles', uid), { username, normalizedUsername: normalized }, { merge: true }),
  ])
}
