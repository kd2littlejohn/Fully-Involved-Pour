import type { BlindGuidanceLevel } from './types'

const PREFIX = 'fip:blindGuidance:'

// A per-user tasting-guidance preference, remembered across Blind sessions
// so it can be pre-selected as the default the next time the Sommelier
// asks. Local-only (not synced to Firestore) since it's a UX preference,
// not journal data worth cross-device sync or security-rule surface area.
// A user with no stored preference yet defaults to 'guide'.
export function readBlindGuidanceLevel(uid: string): BlindGuidanceLevel {
  try {
    const raw = localStorage.getItem(PREFIX + uid)
    return raw === 'guide' || raw === 'casual' || raw === 'minimal' ? raw : 'guide'
  } catch {
    return 'guide'
  }
}

export function writeBlindGuidanceLevel(uid: string, level: BlindGuidanceLevel): void {
  try {
    localStorage.setItem(PREFIX + uid, level)
  } catch {
    // Storage full or unavailable (private browsing) — preference just won't persist.
  }
}
