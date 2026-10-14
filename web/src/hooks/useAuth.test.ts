import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (user: unknown) => void
let listener: Listener | undefined

vi.mock('../data/firebase', () => ({ auth: {} }))
vi.mock('../data/devMode', () => ({ isMockAuthEnabled: () => false }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: Listener) => {
    listener = cb
    return () => {}
  },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    listener = undefined
  })

  it('returns a signed-in FIP account', () => {
    const { result } = renderHook(() => useAuth())
    act(() => listener?.({ uid: 'u1', isAnonymous: false }))
    expect(result.current).toMatchObject({ user: { uid: 'u1' }, loading: false })
  })

  it('treats an anonymous Party guest identity as signed out', () => {
    const { result } = renderHook(() => useAuth())
    act(() => listener?.({ uid: 'guest', isAnonymous: true }))
    expect(result.current).toEqual({ user: null, loading: false })
  })
})
