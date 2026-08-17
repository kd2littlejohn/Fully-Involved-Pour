const PREFIX = 'fip:hiddenBlindRooms:'

// A non-host participant can't delete a Blind Room (only the host can — see
// blindRoom.ts deleteBlindRoom), but they can still remove it from their own
// list. Local-only by design: it's a per-device "don't show me this again"
// preference, not a change to the room itself, so every other participant's
// list is unaffected.
export function readHiddenBlindRoomIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(PREFIX + uid)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function hideBlindRoomForUser(uid: string, roomId: string): void {
  try {
    const ids = readHiddenBlindRoomIds(uid)
    ids.add(roomId)
    localStorage.setItem(PREFIX + uid, JSON.stringify([...ids]))
  } catch {
    // Storage full or unavailable (private browsing) — the room just won't stay hidden.
  }
}
