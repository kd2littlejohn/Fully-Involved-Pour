import { useEffect, useState } from 'react'
import {
  watchMyBallots,
  watchMyGuest,
  watchParty,
  watchPartySecrets,
  watchRecap,
  watchResults,
  watchGuests,
} from '../../data/repositories/party'
import type { Party, PartyBallot, PartyCategoryResults, PartyGuest, PartyRecap, PartySecrets } from './types'

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

export function useParty(partyId: string | undefined, enabled = true): Live<Party | undefined> {
  const [state, setState] = useState<Live<Party | undefined>>({ data: undefined, loading: true, error: null })
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

export function usePartySecrets(partyId: string | undefined, enabled = true): Live<PartySecrets | undefined> {
  const [state, setState] = useState<Live<PartySecrets | undefined>>({ data: undefined, loading: true, error: null })
  useEffect(() => {
    if (!partyId || !enabled) return
    return watchPartySecrets(
      partyId,
      (data) => setState({ data, loading: false, error: null }),
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
