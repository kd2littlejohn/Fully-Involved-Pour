// Every per-user localStorage cache in this app (userDoc, hiddenBlindRooms,
// blindGuidance, pour drafts) follows one of two uid-scoped key shapes:
// `fip:{namespace}:{uid}` or `fip-pour-draft:{uid}:{bottleId}`. Rather than
// hand-maintain a list of every namespace here (which rots the moment a new
// per-user cache is added elsewhere), this sweeps localStorage for any key
// that embeds this uid in either shape and removes it — called on sign-out
// so a shared device doesn't keep a departed account's cached data resident
// longer than it has to.
export function clearUserCache(uid: string): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.endsWith(`:${uid}`) || key.includes(`:${uid}:`))) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) localStorage.removeItem(key)
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
