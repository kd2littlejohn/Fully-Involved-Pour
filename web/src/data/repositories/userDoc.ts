import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserDoc } from '../types'

export const EMPTY_USER_DOC: UserDoc = {
  bottles: [],
  pours: [],
  memories: [],
  infinityBottles: [],
  customLibrary: [],
  people: [],
}

export function userDocRef(uid: string) {
  return doc(db, 'users', uid)
}

export async function fetchUserDoc(uid: string): Promise<UserDoc> {
  const snap = await getDoc(userDocRef(uid))
  if (!snap.exists()) return { ...EMPTY_USER_DOC }
  const data = snap.data() as Partial<UserDoc>
  return {
    ...EMPTY_USER_DOC,
    ...data,
    bottles: data.bottles ?? [],
    pours: data.pours ?? [],
    memories: data.memories ?? [],
    infinityBottles: data.infinityBottles ?? [],
    customLibrary: data.customLibrary ?? [],
    people: data.people ?? [],
  }
}

export async function saveUserDoc(uid: string, patch: Partial<UserDoc>): Promise<void> {
  await setDoc(userDocRef(uid), { ...patch, updatedAt: Date.now() }, { merge: true })
}
