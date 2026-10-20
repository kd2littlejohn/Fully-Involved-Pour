import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (value: unknown) => void
let partyListener: Listener | undefined
let adminListener: Listener | undefined
const mockMigrate = vi.fn()

vi.mock('../../data/repositories/party', () => ({
  watchParty: (_id: string, cb: Listener) => {
    partyListener = cb
    return () => {}
  },
  watchMyAdmin: (_p: string, _u: string, cb: Listener) => {
    adminListener = cb
    return () => {}
  },
  migrateParty: (...a: unknown[]) => mockMigrate(...a),
  watchMyBallots: vi.fn(),
  watchMyGuest: vi.fn(),
  watchRecap: vi.fn(),
  watchResults: vi.fn(),
  watchGuests: vi.fn(),
  watchRoster: vi.fn(),
  watchAdmins: vi.fn(),
}))

import { useMyAdminRole, useParty } from './usePartyData'

describe('useParty', () => {
  beforeEach(() => {
    mockMigrate.mockReset().mockResolvedValue({ ok: true })
  })

  it('asks the server, once, to move admin uids off an older party document', async () => {
    const { rerender } = renderHook(() => useParty('legacy-1'))
    act(() => partyListener?.({ id: 'legacy-1', name: 'Old', hostUid: 'u1', coHostUids: [] }))
    await waitFor(() => expect(mockMigrate).toHaveBeenCalledWith('legacy-1'))
    act(() => partyListener?.({ id: 'legacy-1', name: 'Old', hostUid: 'u1', coHostUids: [], updatedAt: 2 }))
    rerender()
    expect(mockMigrate).toHaveBeenCalledTimes(1)
  })

  it('leaves a current party alone', () => {
    renderHook(() => useParty('new-1'))
    act(() => partyListener?.({ id: 'new-1', name: 'New', hostName: 'Kevin' }))
    expect(mockMigrate).not.toHaveBeenCalled()
  })
})

describe('useMyAdminRole', () => {
  it('reads the role from the caller’s own admin record', () => {
    const { result } = renderHook(() => useMyAdminRole('p1', 'u1'))
    expect(result.current).toEqual({ role: null, loading: true })
    act(() => adminListener?.({ uid: 'u1', role: 'cohost', name: 'Pat', addedAt: 1 }))
    expect(result.current).toEqual({ role: 'cohost', loading: false })
  })

  it('is no role at all for a guest without an admin record', () => {
    const { result } = renderHook(() => useMyAdminRole('p1', 'guest'))
    act(() => adminListener?.(undefined))
    expect(result.current).toEqual({ role: null, loading: false })
  })
})
