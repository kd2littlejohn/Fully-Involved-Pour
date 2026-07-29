import type { UserDoc } from './types'

const PREFIX = 'fip:userDoc:'

// Synchronous bootstrap value only (fast first paint, offline tolerance) —
// Firestore + React state is the actual source of truth. See plan
// §Architecture "Local-first caching".
export function readCachedUserDoc(uid: string): UserDoc | null {
  try {
    const raw = localStorage.getItem(PREFIX + uid)
    return raw ? (JSON.parse(raw) as UserDoc) : null
  } catch {
    return null
  }
}

export function writeCachedUserDoc(uid: string, userDoc: UserDoc): void {
  try {
    localStorage.setItem(PREFIX + uid, JSON.stringify(userDoc))
  } catch {
    // Storage full or unavailable (private browsing) — cache is best-effort.
  }
}
