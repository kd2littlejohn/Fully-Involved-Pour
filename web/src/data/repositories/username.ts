import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

export class UsernameTakenError extends Error {}

function normalize(username: string): string {
  return username.trim().toLowerCase()
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
    setDoc(doc(db, 'profiles', uid), { username }, { merge: true }),
  ])
}
