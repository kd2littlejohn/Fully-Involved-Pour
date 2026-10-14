// Per-device conveniences for a party guest. The real session is the
// Firebase identity (anonymous for most guests), which survives refreshes
// on its own; this only remembers things worth showing again on the same
// device — the recovery code, and unsent score drafts. Every access is
// wrapped: private browsing or blocked storage just means nothing is
// remembered, never a broken page.

const PREFIX = 'fip.party.'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key)
    else window.localStorage.setItem(PREFIX + key, value)
  } catch {
    // Storage unavailable — nothing to remember.
  }
}

export function rememberRecoveryCode(partyId: string, code: string): void {
  write(`recovery.${partyId}`, code)
}

export function recallRecoveryCode(partyId: string): string | null {
  return read(`recovery.${partyId}`)
}

export function saveScoreDraft(partyId: string, categoryId: string, draft: unknown): void {
  write(`draft.${partyId}.${categoryId}`, JSON.stringify(draft))
}

export function loadScoreDraft<T>(partyId: string, categoryId: string): T | null {
  const raw = read(`draft.${partyId}.${categoryId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function clearScoreDraft(partyId: string, categoryId: string): void {
  write(`draft.${partyId}.${categoryId}`, null)
}

export function rememberScoringMode(mode: 'quick' | 'detailed'): void {
  write('scoringMode', mode)
}

export function recallScoringMode(): 'quick' | 'detailed' | null {
  const value = read('scoringMode')
  return value === 'quick' || value === 'detailed' ? value : null
}
