import { useEffect, useState } from 'react'
import {
  watchMyBallots,
  watchMyGuest,
  watchParty,
  watchRecap,
  watchResults,
  watchGuests,
  watchRoster,
  watchMyAdmin,
  watchAdmins,
  migrateParty,
} from '../../data/repositories/party'
import type { PartyAdmin, PartyAdminRole, PartyRosterEntry, Party, PartyBallot, PartyCategoryResults, PartyGuest, PartyRecap } from './types'

// Live subscriptions for Party Mode screens. A party is genuinely real-time
// (rounds open and close, ballots arrive, results are revealed while
// everyone watches), so these use onSnapshot like useBlindRoom does.
// Each hook takes an `enabled` flag so a screen can wait until it has an
// identity (and therefore read access) before subscribing.

interface Live<T> {
  data: T
  loading: boolean
  error: string | null
}

function accessError(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
  return code === 'permission-denied' ? 'denied' : 'unavailable'
}

// A party document from before admin records existed still names its
// admins by uid; ask the server to move them (once per page load).
const migrationRequested = new Set<string>()
function hasLegacyAdmins(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && ['hostUid', 'coHostUids', 'coHosts'].some((f) => f in (data as object)))
}

export function useParty(partyId: string | undefined, enabled = true): Live<Party | undefined> {
  const [state, setState] = useState<Live<Party | undefined>>({ data: undefined, loading: true, error: null })
  useEffect(() => {
    if (!partyId || !hasLegacyAdmins(state.data) || migrationRequested.has(partyId)) return
    migrationRequested.add(partyId)
    migrateParty(partyId).catch((err) => console.error('[party] migrate', err))
  }, [partyId, state.data])
  useEffect(() => {
    if (!partyId || !enabled) return
    setState((s) => ({ ...s, loading: true, error: null }))
    return watchParty(
      partyId,
      (data) => setState({ data, loading: false, error: data ? null : 'missing' }),
      (err) => setState({ data: undefined, loading: false, error: accessError(err) }),
    )
  }, [partyId, enabled])
  return state
}

export function usePartyResults(partyId: string | undefined, enabled = true): Live<Record<string, PartyCategoryResults>> {
  const [state, setState] = useState<Live<Record<string, PartyCategoryResults>>>({ data: {}, loading: true, error: null })
  useEffect(() => {
    if (!partyId || !enabled) return
    return watchResults(
      partyId,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: {}, loading: false, error: accessError(err) }),
    )
  }, [partyId, enabled])
  return state
}

export function usePartyRecap(partyId: string | undefined, enabled = true): Live<PartyRecap | undefined> {
  const [state, setState] = useState<Live<PartyRecap | undefined>>({ data: undefined, loading: true, error: null })
  useEffect(() => {
    if (!partyId || !enabled) return
    return watchRecap(
      partyId,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: undefined, loading: false, error: accessError(err) }),
    )
  }, [partyId, enabled])
  return state
}

export function useMyGuest(partyId: string | undefined, uid: string | undefined): Live<PartyGuest | undefined> {
  const [state, setState] = useState<Live<PartyGuest | undefined>>({ data: undefined, loading: true, error: null })
  useEffect(() => {
    if (!partyId || !uid) {
      setState({ data: undefined, loading: !uid ? true : false, error: null })
      return
    }
    return watchMyGuest(
      partyId,
      uid,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: undefined, loading: false, error: accessError(err) }),
    )
  }, [partyId, uid])
  return state
}

export function useMyBallots(partyId: string | undefined, uid: string | undefined, enabled = true): Live<PartyBallot[]> {
  const [state, setState] = useState<Live<PartyBallot[]>>({ data: [], loading: true, error: null })
  useEffect(() => {
    if (!partyId || !uid || !enabled) return
    return watchMyBallots(
      partyId,
      uid,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: [], loading: false, error: accessError(err) }),
    )
  }, [partyId, uid, enabled])
  return state
}

export function usePartyGuests(partyId: string | undefined, enabled = true): Live<PartyGuest[]> {
  const [state, setState] = useState<Live<PartyGuest[]>>({ data: [], loading: true, error: null })
  useEffect(() => {
    if (!partyId || !enabled) return
    return watchGuests(
      partyId,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: [], loading: false, error: accessError(err) }),
    )
  }, [partyId, enabled])
  return state
}

// The shared "Who's Tasting" list: live for every member of the party.
export function usePartyRoster(partyId: string | undefined, enabled = true): Live<PartyRosterEntry[]> {
  const [state, setState] = useState<Live<PartyRosterEntry[]>>({ data: [], loading: true, error: null })
  useEffect(() => {
    if (!partyId || !enabled) return
    return watchRoster(
      partyId,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: [], loading: false, error: accessError(err) }),
    )
  }, [partyId, enabled])
  return state
}

// The signed-in account's role in this party, from its own protected admin
// record: 'host', 'cohost', or null for everyone else.
export function useMyAdminRole(partyId: string | undefined, uid: string | undefined): { role: PartyAdminRole | null; loading: boolean } {
  const [state, setState] = useState<{ key: string; role: PartyAdminRole | null; loading: boolean }>({ key: '', role: null, loading: true })
  const key = partyId && uid ? `${partyId}:${uid}` : ''
  useEffect(() => {
    if (!partyId || !uid) {
      setState({ key: '', role: null, loading: false })
      return
    }
    setState({ key: `${partyId}:${uid}`, role: null, loading: true })
    return watchMyAdmin(
      partyId,
      uid,
      (admin) => setState({ key: `${partyId}:${uid}`, role: admin?.role ?? null, loading: false }),
      () => setState({ key: `${partyId}:${uid}`, role: null, loading: false }),
    )
  }, [partyId, uid])
  return { role: state.key === key ? state.role : null, loading: key !== '' && (state.key !== key || state.loading) }
}

// Everyone who runs the party (admins only).
export function usePartyAdmins(partyId: string | undefined, enabled = true): Live<PartyAdmin[]> {
  const [state, setState] = useState<Live<PartyAdmin[]>>({ data: [], loading: true, error: null })
  useEffect(() => {
    if (!partyId || !enabled) return
    return watchAdmins(
      partyId,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: [], loading: false, error: accessError(err) }),
    )
  }, [partyId, enabled])
  return state
}
