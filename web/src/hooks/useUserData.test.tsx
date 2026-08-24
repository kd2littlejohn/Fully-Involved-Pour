import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { UserDataProvider, useUserData } from './useUserData'
import { DEFAULT_PRIVACY_SETTINGS, type UserDoc } from '../data/types'

const mockUseAuth = vi.fn()
const mockFetchUserDoc = vi.fn()
const mockFetchProfile = vi.fn()
const mockEnsureSearchableProfile = vi.fn()
const mockReadCachedUserDoc = vi.fn()
const mockSyncSharedCollection = vi.fn()
const mockSaveUserDoc = vi.fn()

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
  EMPTY_USER_DOC: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
  fetchUserDoc: (...args: unknown[]) => mockFetchUserDoc(...args),
  saveUserDoc: (...args: unknown[]) => mockSaveUserDoc(...args),
}))

vi.mock('../data/repositories/username', () => ({
  claimUsername: vi.fn(),
}))

vi.mock('../data/repositories/profile', () => ({
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
  ensureSearchableProfile: (...args: unknown[]) => mockEnsureSearchableProfile(...args),
  saveProfile: vi.fn(),
}))

vi.mock('../data/repositories/sharedCollections', () => ({
  syncSharedCollection: (...args: unknown[]) => mockSyncSharedCollection(...args),
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
    customLibrary: [], people: [],
  }
}

describe('useUserData — account switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadCachedUserDoc.mockReturnValue(undefined)
    mockFetchProfile.mockResolvedValue(undefined)
    // Pass-through default, matching the real no-op behavior when nothing
    // needs creating or repairing — tests that care about an actual
    // creation/repair override this per-call.
    mockEnsureSearchableProfile.mockImplementation((_uid: string, existing: unknown) => Promise.resolve(existing))
    mockSyncSharedCollection.mockResolvedValue(undefined)
    mockSaveUserDoc.mockResolvedValue(undefined)
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

  it('backfills a searchable public profile when the signed-in user has none yet', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1', displayName: 'Kevin Littlejohn', photoURL: 'https://example.com/p.jpg' },
      loading: false,
    })
    mockFetchUserDoc.mockResolvedValue(docWithOneBottle('Eagle Rare'))
    mockFetchProfile.mockResolvedValueOnce(undefined)
    mockEnsureSearchableProfile.mockResolvedValueOnce({ username: 'kevin_littlejohn', displayName: 'Kevin Littlejohn' })

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })

    await waitFor(() =>
      expect(mockEnsureSearchableProfile).toHaveBeenCalledWith('user-1', undefined, {
        preferredUsername: undefined,
        displayName: 'Kevin Littlejohn',
        photoURL: 'https://example.com/p.jpg',
      }),
    )
    await waitFor(() => expect(result.current.profile?.username).toBe('kevin_littlejohn'))
  })

  it('passes an existing profile through to ensureSearchableProfile, which may repair it in place', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(docWithOneBottle('Eagle Rare'))
    const staleProfile = { username: 'captainpouralot', displayName: 'Captain Pour-a-lot' }
    mockFetchProfile.mockResolvedValueOnce(staleProfile)
    mockEnsureSearchableProfile.mockResolvedValueOnce({
      ...staleProfile,
      normalizedUsername: 'captainpouralot',
      normalizedDisplayName: 'captain pour-a-lot',
    })

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })

    await waitFor(() => expect(mockEnsureSearchableProfile).toHaveBeenCalledWith('user-1', staleProfile, expect.anything()))
    await waitFor(() => expect(result.current.profile?.normalizedUsername).toBe('captainpouralot'))
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

  it('syncs the shared-collection projection once both userDoc and profile have finished loading, not before', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = docWithOneBottle('Eagle Rare')

    let resolveFetchUserDoc: (d: UserDoc) => void = () => {}
    mockFetchUserDoc.mockReturnValueOnce(
      new Promise<UserDoc>((resolve) => {
        resolveFetchUserDoc = resolve
      }),
    )
    mockFetchProfile.mockResolvedValueOnce({ username: 'user1', displayName: 'User One' })

    renderHook(() => useUserData(), { wrapper: UserDataProvider })

    // Profile has already resolved, but userDoc hasn't — the sync must wait
    // for both, since it needs the real bottle list to project.
    await waitFor(() => expect(mockEnsureSearchableProfile).toHaveBeenCalled())
    expect(mockSyncSharedCollection).not.toHaveBeenCalled()

    resolveFetchUserDoc(doc)

    await waitFor(() => expect(mockSyncSharedCollection).toHaveBeenCalledWith('user-1', doc, DEFAULT_PRIVACY_SETTINGS))
  })
})

describe('useUserData — updatePourAiSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadCachedUserDoc.mockReturnValue(undefined)
    mockFetchProfile.mockResolvedValue(undefined)
    mockEnsureSearchableProfile.mockImplementation((_uid: string, existing: unknown) => Promise.resolve(existing))
    mockSyncSharedCollection.mockResolvedValue(undefined)
    mockSaveUserDoc.mockResolvedValue(undefined)
  })

  function docWithPour(): UserDoc {
    return {
      bottles: [],
      pours: [
        {
          id: 'p1',
          bottleId: 'b1',
          date: '2026-08-14',
          rating: 8.6,
          fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 1, total: 8.6, noseAromas: [], palateFlavors: [] },
        },
      ],
      memories: [],
      infinityBottles: [],
      customLibrary: [], people: [],
    }
  }

  it('merges the AI summary onto the matching pour and persists only the pours field', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(docWithPour())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.pours).toHaveLength(1))

    const aiSummary = { text: 'A bright, easy-drinking pour.', sourceHash: 'hash-1', generatedAt: 123 }
    await result.current.updatePourAiSummary('p1', aiSummary)

    await waitFor(() => expect(result.current.userDoc.pours[0]?.aiSummary).toEqual(aiSummary))
    expect(mockSaveUserDoc).toHaveBeenCalledWith('user-1', { pours: expect.arrayContaining([expect.objectContaining({ id: 'p1', aiSummary })]) })
  })

  it('reads the freshest pours at call time even when the function reference was captured before a later pour was added', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(docWithPour())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.pours).toHaveLength(1))

    // Captured "early" — mirrors PourWizard grabbing this from useUserData()
    // well before its fire-and-forget AI call actually resolves.
    const capturedUpdate = result.current.updatePourAiSummary

    // A second pour lands in the meantime (e.g. the user logs another pour
    // before the first one's AI summary comes back).
    await result.current.addPour({
      bottleId: 'b1',
      date: '2026-08-15',
      rating: 9.0,
      fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: 9, noseAromas: [], palateFlavors: [] },
    })
    await waitFor(() => expect(result.current.userDoc.pours).toHaveLength(2))

    await capturedUpdate('p1', { text: 'Reflection.', sourceHash: 'hash-1', generatedAt: 1 })

    // If this had used a stale closure over the pre-second-pour userDoc, the
    // second pour would have been silently dropped from this write.
    await waitFor(() =>
      expect(mockSaveUserDoc).toHaveBeenLastCalledWith('user-1', {
        pours: expect.arrayContaining([
          expect.objectContaining({ id: 'p1', aiSummary: expect.objectContaining({ text: 'Reflection.' }) }),
          expect.objectContaining({ bottleId: 'b1', rating: 9 }),
        ]),
      }),
    )
  })
})

describe('useUserData — updatePourMemoryPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadCachedUserDoc.mockReturnValue(undefined)
    mockFetchProfile.mockResolvedValue(undefined)
    mockEnsureSearchableProfile.mockImplementation((_uid: string, existing: unknown) => Promise.resolve(existing))
    mockSyncSharedCollection.mockResolvedValue(undefined)
    mockSaveUserDoc.mockResolvedValue(undefined)
  })

  function docWithPour(): UserDoc {
    return {
      bottles: [],
      pours: [
        {
          id: 'p1',
          bottleId: 'b1',
          date: '2026-08-14',
          rating: 8.6,
          fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 1, total: 8.6, noseAromas: [], palateFlavors: [] },
        },
      ],
      memories: [],
      infinityBottles: [],
      customLibrary: [],
      people: [],
    }
  }

  it('merges the memory photo onto the matching pour', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(docWithPour())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.pours).toHaveLength(1))

    const memoryPhoto = { url: 'https://example.com/photo.jpg', storagePath: 'memory-photos/user-1/1-photo.jpg', createdAt: 123 }
    await result.current.updatePourMemoryPhoto('p1', memoryPhoto)

    await waitFor(() => expect(result.current.userDoc.pours[0]?.memoryPhoto).toEqual(memoryPhoto))
  })

  it('clears the memory photo when given undefined, without touching anything else on the pour', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const withPhoto = docWithPour()
    withPhoto.pours[0]!.memoryPhoto = { url: 'https://example.com/old.jpg', createdAt: 1 }
    mockFetchUserDoc.mockResolvedValue(withPhoto)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.pours[0]?.memoryPhoto).toBeDefined())

    await result.current.updatePourMemoryPhoto('p1', undefined)

    await waitFor(() => expect(result.current.userDoc.pours[0]?.memoryPhoto).toBeUndefined())
    expect(result.current.userDoc.pours[0]?.id).toBe('p1')
  })

  it('reads the freshest pours at call time, not a stale snapshot from before the wizard unmounted', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(docWithPour())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.pours).toHaveLength(1))

    const capturedUpdate = result.current.updatePourMemoryPhoto

    await result.current.addPour({
      bottleId: 'b1',
      date: '2026-08-15',
      rating: 9.0,
      fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: 9, noseAromas: [], palateFlavors: [] },
    })
    await waitFor(() => expect(result.current.userDoc.pours).toHaveLength(2))

    await capturedUpdate('p1', { url: 'https://example.com/photo.jpg', createdAt: 1 })

    await waitFor(() =>
      expect(mockSaveUserDoc).toHaveBeenLastCalledWith('user-1', {
        pours: expect.arrayContaining([
          expect.objectContaining({ id: 'p1', memoryPhoto: expect.objectContaining({ url: 'https://example.com/photo.jpg' }) }),
          expect.objectContaining({ bottleId: 'b1', rating: 9 }),
        ]),
      }),
    )
  })
})

describe('useUserData — addOrReusePerson / updatePersonPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadCachedUserDoc.mockReturnValue(undefined)
    mockFetchProfile.mockResolvedValue(undefined)
    mockEnsureSearchableProfile.mockImplementation((_uid: string, existing: unknown) => Promise.resolve(existing))
    mockSyncSharedCollection.mockResolvedValue(undefined)
    mockSaveUserDoc.mockResolvedValue(undefined)
  })

  function emptyDoc(): UserDoc {
    return { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] }
  }

  it('creates a new person when no existing one matches', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(emptyDoc())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const person = await result.current.addOrReusePerson('Marcus')

    expect(person?.name).toBe('Marcus')
    await waitFor(() => expect(result.current.userDoc.people).toHaveLength(1))
  })

  it('reuses an existing person for a normalized-equal name instead of creating a duplicate', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.people = [{ id: 'p1', name: 'Marcus', normalizedName: 'marcus', createdAt: 1 }]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.people).toHaveLength(1))

    const person = await result.current.addOrReusePerson('  MARCUS ')

    expect(person?.id).toBe('p1')
    expect(result.current.userDoc.people).toHaveLength(1)
    expect(mockSaveUserDoc).not.toHaveBeenCalled()
  })

  it('updatePersonPhoto sets an avatar that is then reused by every future lookup of that person', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.people = [{ id: 'p1', name: 'Marcus', normalizedName: 'marcus', createdAt: 1 }]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.people).toHaveLength(1))

    await result.current.updatePersonPhoto('p1', { photoUrl: 'https://example.com/marcus.jpg', photoStoragePath: 'person-photos/user-1/1-marcus.jpg' })

    await waitFor(() => expect(result.current.userDoc.people[0]?.photoUrl).toBe('https://example.com/marcus.jpg'))
  })

  it('updatePersonPhoto clears the avatar when given undefined', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.people = [{ id: 'p1', name: 'Marcus', normalizedName: 'marcus', photoUrl: 'https://example.com/old.jpg', createdAt: 1 }]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.people[0]?.photoUrl).toBeDefined())

    await result.current.updatePersonPhoto('p1', undefined)

    await waitFor(() => expect(result.current.userDoc.people[0]?.photoUrl).toBeUndefined())
  })
})
