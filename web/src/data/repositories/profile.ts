import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Profile } from '../types'

// profiles/{uid} — same public doc username.ts already writes `username`
// into. Public read (see firestore.rules), owner-only write.
export async function fetchProfile(uid: string): Promise<Profile | undefined> {
  const snap = await getDoc(doc(db, 'profiles', uid))
  return snap.exists() ? (snap.data() as Profile) : undefined
}

export async function saveProfile(uid: string, patch: Partial<Omit<Profile, 'username'>>): Promise<void> {
  await setDoc(doc(db, 'profiles', uid), patch, { merge: true })
}
