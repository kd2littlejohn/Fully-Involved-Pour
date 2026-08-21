import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { UserDataProvider, useUserData } from './useUserData'
import type { UserDoc } from '../data/types'

const mockUseAuth = vi.fn()
const mockFetchUserDoc = vi.fn()
const mockFetchProfile = vi.fn()
const mockReadCachedUserDoc = vi.fn()

vi.mock('./useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../data/devMode', () => ({
  isMockAuthEnabled: () => false,
}))

vi.mock('../data/firebase', () => ({
  auth: {},
}))

vi.mock('firebase/auth', () => ({
  updateProfile: vi.fn(),
}))

vi.mock('../data/repositories/userDoc', () => ({
  EMPTY_USER_DOC: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
  fetchUserDoc: (...args: unknown[]) => mockFetchUserDoc(...args),
  saveUserDoc: vi.fn(),
}))

vi.mock('../data/repositories/username', () => ({
  claimUsername: vi.fn(),
}))

vi.mock('../data/repositories/profile', () => ({
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
  saveProfile: vi.fn(),
}))

vi.mock('../data/localCache', () => ({
  readCachedUserDoc: (...args: unknown[]) => mockReadCachedUserDoc(...args),
  writeCachedUserDoc: vi.fn(),
}))

function docWithOneBottle(name: string): UserDoc {
  return {
    bottles: [{ id: name, name, status: 'sealed', createdAt: 1 }],
    pours: [],
    memories: [],
    infinityBottles: [],
    customLibrary: [],
  }
}

describe('useUserData — account switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadCachedUserDoc.mockReturnValue(undefined)
    mockFetchProfile.mockResolvedValue(undefined)
  })

  it('does not keep showing the previous account’s bottles while the newly signed-in account’s data is still loading', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValueOnce(docWithOneBottle('Eagle Rare (User 1)'))

    const { result, rerender } = renderHook(() => useUserData(), { wrapper: UserDataProvider })

    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))
    expect(result.current.userDoc.bottles[0]?.name).toBe('Eagle Rare (User 1)')

    // Same-tab switch to a different signed-in account, with no intervening
    // sign-out render — user-2's fetch is left deliberately unresolved so we
    // can inspect state before it lands.
    let resolveUser2Fetch: (doc: UserDoc) => void = () => {}
    mockFetchUserDoc.mockReturnValueOnce(
      new Promise<UserDoc>((resolve) => {
        resolveUser2Fetch = resolve
      }),
    )
    mockUseAuth.mockReturnValue({ user: { uid: 'user-2' }, loading: false })
    rerender()

    expect(result.current.userDoc.bottles).toHaveLength(0)

    resolveUser2Fetch(docWithOneBottle('Weller 12 (User 2)'))

    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))
    expect(result.current.userDoc.bottles[0]?.name).toBe('Weller 12 (User 2)')
  })

  it('clears profile immediately on a direct account switch too', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(docWithOneBottle('Eagle Rare'))
    mockFetchProfile.mockResolvedValueOnce({ username: 'user1', displayName: 'User One' })

    const { result, rerender } = renderHook(() => useUserData(), { wrapper: UserDataProvider })

    await waitFor(() => expect(result.current.profile?.username).toBe('user1'))

    let resolveUser2Profile: (p: { username: string }) => void = () => {}
    mockFetchProfile.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUser2Profile = resolve
      }),
    )
    mockUseAuth.mockReturnValue({ user: { uid: 'user-2' }, loading: false })
    rerender()

    expect(result.current.profile).toBeUndefined()

    resolveUser2Profile({ username: 'user2' })
    await waitFor(() => expect(result.current.profile?.username).toBe('user2'))
  })

  it('resets to empty on sign-out', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValueOnce(docWithOneBottle('Eagle Rare'))

    const { result, rerender } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    mockUseAuth.mockReturnValue({ user: null, loading: false })
    rerender()

    expect(result.current.userDoc.bottles).toHaveLength(0)
    expect(result.current.profile).toBeUndefined()
  })
})
