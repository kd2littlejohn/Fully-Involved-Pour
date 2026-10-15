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

// The host's dashboard view (Manage Party or My Tasting), so coming back
// from Paper Ballots or a refresh lands where they left off.
export type HostView = 'manage' | 'tasting'

export function rememberHostView(partyId: string, view: HostView): void {
  write(`hostView.${partyId}`, view)
}

export function recallHostView(partyId: string): HostView | null {
  const value = read(`hostView.${partyId}`)
  return value === 'manage' || value === 'tasting' ? value : null
}

// The round a taster last chose to look at, and the sample they last
// touched in it — reopening My Tasting returns to both.
export function rememberMyRound(partyId: string, categoryId: string): void {
  write(`round.${partyId}`, categoryId)
}

export function recallMyRound(partyId: string): string | null {
  return read(`round.${partyId}`)
}

export function rememberLastSample(partyId: string, categoryId: string, label: string): void {
  write(`sample.${partyId}.${categoryId}`, label)
}

export function recallLastSample(partyId: string, categoryId: string): string | null {
  return read(`sample.${partyId}.${categoryId}`)
}
