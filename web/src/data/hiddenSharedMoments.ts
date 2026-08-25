const PREFIX = 'fip:hiddenSharedMoments:'

// A participant can't delete a SharedMoment (only the owner can — see
// data/repositories/sharedMoments.ts deleteSharedMoment), but they can
// still remove it from their own "Shared With You" view. Local-only by
// design, same shape as data/hiddenBlindRooms.ts: a per-device "don't show
// me this again" preference, not a change to the moment itself, so every
// other participant's (and the owner's) view is unaffected.
export function readHiddenSharedMomentIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(PREFIX + uid)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function hideSharedMomentForUser(uid: string, momentId: string): void {
  try {
    const ids = readHiddenSharedMomentIds(uid)
    ids.add(momentId)
    localStorage.setItem(PREFIX + uid, JSON.stringify([...ids]))
  } catch {
    // Storage full or unavailable (private browsing) — the moment just won't stay hidden.
  }
}
