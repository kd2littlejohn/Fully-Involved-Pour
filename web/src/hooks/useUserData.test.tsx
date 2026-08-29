import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { UserDataProvider, useUserData } from './useUserData'
import { DEFAULT_PRIVACY_SETTINGS, type Bottle, type UserDoc } from '../data/types'

const mockUseAuth = vi.fn()
const mockFetchUserDoc = vi.fn()
const mockFetchProfile = vi.fn()
const mockEnsureSearchableProfile = vi.fn()
const mockReadCachedUserDoc = vi.fn()
const mockSyncSharedCollection = vi.fn()
const mockSaveUserDoc = vi.fn()
const mockDeletePhotoIfSafe = vi.fn().mockResolvedValue(undefined)
const mockDeleteSharedMomentsForStory = vi.fn().mockResolvedValue(undefined)

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

vi.mock('../features/photoUpload/uploadPhoto', () => ({
  deletePhotoIfSafe: (...args: unknown[]) => mockDeletePhotoIfSafe(...args),
}))

vi.mock('../data/repositories/sharedMoments', () => ({
  deleteSharedMomentsForStory: (...args: unknown[]) => mockDeleteSharedMomentsForStory(...args),
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

describe('useUserData — Storage cleanup on delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadCachedUserDoc.mockReturnValue(undefined)
    mockFetchProfile.mockResolvedValue(undefined)
    mockEnsureSearchableProfile.mockImplementation((_uid: string, existing: unknown) => Promise.resolve(existing))
    mockSyncSharedCollection.mockResolvedValue(undefined)
    mockSaveUserDoc.mockResolvedValue(undefined)
    mockDeletePhotoIfSafe.mockResolvedValue(undefined)
    mockDeleteSharedMomentsForStory.mockResolvedValue(undefined)
  })

  it('deleteBottles cleans up the bottle image, original image, and every gallery photo, plus any of its pours’ memory photos', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue({
      bottles: [
        {
          id: 'b1',
          name: 'Eagle Rare',
          status: 'open',
          imageUrl: 'https://x/img.jpg',
          imageStoragePath: 'bottle-photos/user-1/1-img.jpg',
          originalImageUrl: 'https://x/orig.jpg',
          originalImageStoragePath: 'bottle-photos/user-1/1-orig.jpg',
          gallery: [{ url: 'https://x/g1.jpg', storagePath: 'bottle-photos/user-1/1-g1.jpg' }],
        },
      ],
      pours: [
        {
          id: 'p1',
          bottleId: 'b1',
          date: '2026-08-14',
          rating: 8.6,
          memoryPhoto: { url: 'https://x/moment.jpg', storagePath: 'memory-photos/user-1/1-moment.jpg', createdAt: 1 },
          fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 1, total: 8.6, noseAromas: [], palateFlavors: [] },
        },
      ],
      memories: [],
      infinityBottles: [],
      customLibrary: [],
      people: [],
    })

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.deleteBottle('b1')

    await waitFor(() => {
      expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('bottle-photos/user-1/1-img.jpg')
      expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('bottle-photos/user-1/1-orig.jpg')
      expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('bottle-photos/user-1/1-g1.jpg')
      expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('memory-photos/user-1/1-moment.jpg')
    })
    expect(mockDeleteSharedMomentsForStory).toHaveBeenCalledWith('p1', 'user-1')
  })

  it('deletePour cleans up its memory photo and any SharedMoment it created', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue({
      bottles: [],
      pours: [
        {
          id: 'p1',
          bottleId: 'b1',
          date: '2026-08-14',
          rating: 8.6,
          memoryPhoto: { url: 'https://x/moment.jpg', storagePath: 'memory-photos/user-1/1-moment.jpg', createdAt: 1 },
          fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 1, total: 8.6, noseAromas: [], palateFlavors: [] },
        },
      ],
      memories: [],
      infinityBottles: [],
      customLibrary: [],
      people: [],
    })

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.pours).toHaveLength(1))

    await result.current.deletePour('p1')

    await waitFor(() => expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('memory-photos/user-1/1-moment.jpg'))
    expect(mockDeleteSharedMomentsForStory).toHaveBeenCalledWith('p1', 'user-1')
  })

  it('deleteMemory cleans up its photo', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue({
      bottles: [],
      pours: [],
      memories: [
        {
          id: 'm1',
          title: 'Porch night',
          date: '2026-08-14',
          people: [],
          story: 'Great evening.',
          photoUrl: 'https://x/photo.jpg',
          photoStoragePath: 'memory-photos/user-1/1-photo.jpg',
        },
      ],
      infinityBottles: [],
      customLibrary: [],
      people: [],
    })

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.memories).toHaveLength(1))

    await result.current.deleteMemory('m1')

    await waitFor(() => expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('memory-photos/user-1/1-photo.jpg'))
  })

  it('deleteGalleryPhoto removes only the targeted photo and cleans up its storage file', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue({
      bottles: [
        {
          id: 'b1',
          name: 'Eagle Rare',
          status: 'open',
          gallery: [
            { url: 'https://x/g1.jpg', storagePath: 'bottle-photos/user-1/1-g1.jpg' },
            { url: 'https://x/g2.jpg', storagePath: 'bottle-photos/user-1/1-g2.jpg' },
          ],
        },
      ],
      pours: [],
      memories: [],
      infinityBottles: [],
      customLibrary: [],
      people: [],
    })

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles[0]?.gallery).toHaveLength(2))

    await result.current.deleteGalleryPhoto('b1', 'https://x/g1.jpg')

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.gallery).toHaveLength(1))
    expect(result.current.userDoc.bottles[0]?.gallery?.[0]?.url).toBe('https://x/g2.jpg')
    expect(mockSaveUserDoc).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ bottles: [expect.objectContaining({ gallery: [expect.objectContaining({ url: 'https://x/g2.jpg' })] })] }),
    )
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('bottle-photos/user-1/1-g1.jpg')
    expect(mockDeletePhotoIfSafe).not.toHaveBeenCalledWith('bottle-photos/user-1/1-g2.jpg')
  })

  // Regression test for a real bug: deleteGalleryPhoto used to update local
  // state optimistically before the Firestore write resolved, so a failed
  // save still showed the photo as gone — surviving only until the next
  // fetch (e.g. a refresh) brought the old data right back. It must now wait
  // for the write to actually succeed before touching local state at all.
  it('leaves the photo in place and never touches Storage if the Firestore write fails', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue({
      bottles: [
        {
          id: 'b1',
          name: 'Eagle Rare',
          status: 'open',
          gallery: [{ url: 'https://x/g1.jpg', storagePath: 'bottle-photos/user-1/1-g1.jpg' }],
        },
      ],
      pours: [],
      memories: [],
      infinityBottles: [],
      customLibrary: [],
      people: [],
    })
    mockSaveUserDoc.mockRejectedValueOnce(new Error('simulated Firestore write failure'))

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles[0]?.gallery).toHaveLength(1))

    await expect(result.current.deleteGalleryPhoto('b1', 'https://x/g1.jpg')).rejects.toThrow(
      'simulated Firestore write failure',
    )

    expect(result.current.userDoc.bottles[0]?.gallery).toHaveLength(1)
    expect(result.current.userDoc.bottles[0]?.gallery?.[0]?.url).toBe('https://x/g1.jpg')
    expect(mockDeletePhotoIfSafe).not.toHaveBeenCalled()
  })
})

describe('useUserData — Infinity Bottle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadCachedUserDoc.mockReturnValue(undefined)
    mockFetchProfile.mockResolvedValue(undefined)
    mockEnsureSearchableProfile.mockImplementation((_uid: string, existing: unknown) => Promise.resolve(existing))
    mockSyncSharedCollection.mockResolvedValue(undefined)
    mockSaveUserDoc.mockResolvedValue(undefined)
    mockDeletePhotoIfSafe.mockResolvedValue(undefined)
  })

  function emptyDoc(): UserDoc {
    return { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] }
  }

  it('createInfinityBottle creates a vessel with one initial active batch and returns its id', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(emptyDoc())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const id = await result.current.createInfinityBottle({ name: 'Backdraft Batch', capacityMl: 1000, batchName: 'First Due' })

    expect(id).toBeDefined()
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))
    const ib = result.current.userDoc.infinityBottles[0]!
    expect(ib.name).toBe('Backdraft Batch')
    expect(ib.capacityMl).toBe(1000)
    expect(ib.archived).toBe(false)
    expect(ib.batches).toHaveLength(1)
    expect(ib.batches[0]?.status).toBe('active')
    expect(ib.batches[0]?.name).toBe('First Due')
    expect(ib.batches[0]?.additions).toEqual([])
  })

  it('updateInfinityBottle patches only the given fields', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Old Name', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await result.current.updateInfinityBottle('ib1', { name: 'New Name', capacityMl: 750 })

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.name).toBe('New Name'))
    expect(result.current.userDoc.infinityBottles[0]?.capacityMl).toBe(750)
  })

  it('archiveInfinityBottle toggles the vessel-level archived flag', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Vessel', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await result.current.archiveInfinityBottle('ib1', true)

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.archived).toBe(true))
  })

  it('deleteInfinityBottle removes the vessel, cleans up its photo and every tasting photo, and never touches bottles[]', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [{ id: 'src1', name: 'Eagle Rare', status: 'open' }]
    doc.infinityBottles = [
      {
        id: 'ib1',
        name: 'Vessel',
        photoUrl: 'https://x/ib.jpg',
        photoStoragePath: 'infinity-bottle-photos/user-1/1-ib.jpg',
        archived: false,
        createdAt: 1,
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [],
            tastings: [
              {
                id: 't1',
                date: '2026-01-01',
                score: 8,
                noseAromas: [],
                palateFlavors: [],
                photoUrl: 'https://x/t1.jpg',
                photoStoragePath: 'infinity-bottle-photos/user-1/1-t1.jpg',
                createdAt: 1,
              },
            ],
          },
        ],
      },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await result.current.deleteInfinityBottle('ib1')

    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(0))
    expect(result.current.userDoc.bottles).toHaveLength(1)
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('infinity-bottle-photos/user-1/1-ib.jpg')
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('infinity-bottle-photos/user-1/1-t1.jpg')
  })

  it('deleteInfinityBottle leaves the vessel in place and never touches Storage if the Firestore write fails', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Vessel', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)
    mockSaveUserDoc.mockRejectedValueOnce(new Error('write failed'))

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await expect(result.current.deleteInfinityBottle('ib1')).rejects.toThrow('write failed')

    expect(result.current.userDoc.infinityBottles).toHaveLength(1)
    expect(mockDeletePhotoIfSafe).not.toHaveBeenCalled()
  })

  it('addBlendAdditions appends a snapshot addition to the given batch (single-item array)', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Vessel', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await result.current.addBlendAdditions('ib1', 'b1', [
      {
        sourceBottleId: 'src1',
        bottleName: 'Eagle Rare',
        proof: 90,
        amountMl: 60,
        date: '2026-01-01',
        note: 'Finishing the bottle.',
      },
    ])

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions).toHaveLength(1))
    expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions[0]).toMatchObject({
      bottleName: 'Eagle Rare',
      amountMl: 60,
      note: 'Finishing the bottle.',
    })
  })

  it('addBlendAdditions saves several additions in exactly one Firestore write, each keeping its own record', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Vessel', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await result.current.addBlendAdditions('ib1', 'b1', [
      { sourceBottleId: 'src1', bottleName: 'Weller 107', proof: 107, amountMl: 60, date: '2026-08-25', note: 'Add sweetness and proof' },
      { sourceBottleId: 'src2', bottleName: 'Old Grand-Dad 114', proof: 114, amountMl: 30, date: '2026-08-25', note: 'Add spice' },
      { sourceBottleId: 'src3', bottleName: 'Buffalo Trace', proof: 90, amountMl: 90, date: '2026-08-25', note: 'Soften the blend' },
    ])

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions).toHaveLength(3))
    const additions = result.current.userDoc.infinityBottles[0]!.batches[0]!.additions
    expect(additions.map((a) => a.bottleName)).toEqual(['Weller 107', 'Old Grand-Dad 114', 'Buffalo Trace'])
    // Never combined into one record — each keeps its own id, amount, and note.
    expect(new Set(additions.map((a) => a.id)).size).toBe(3)
    expect(additions.map((a) => a.amountMl)).toEqual([60, 30, 90])
    expect(additions.map((a) => a.note)).toEqual(['Add sweetness and proof', 'Add spice', 'Soften the blend'])

    // Exactly one saveUserDoc call carried all three — never three separate writes.
    const infinityWrites = mockSaveUserDoc.mock.calls.filter(([, patch]) => (patch as Partial<UserDoc>).infinityBottles)
    expect(infinityWrites).toHaveLength(1)
    expect(infinityWrites[0]![1].infinityBottles[0].batches[0].additions).toHaveLength(3)
  })

  it('addBlendAdditions writes to Firestore before committing local state — a failed save leaves userDoc unchanged', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Vessel', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)
    mockSaveUserDoc.mockRejectedValueOnce(new Error('write failed'))

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await expect(
      result.current.addBlendAdditions('ib1', 'b1', [
        { sourceBottleId: 'src1', bottleName: 'Weller 107', amountMl: 60, date: '2026-08-25' },
        { sourceBottleId: 'src2', bottleName: 'Old Grand-Dad 114', amountMl: 30, date: '2026-08-25' },
      ]),
    ).rejects.toThrow('write failed')

    // Local state was never optimistically updated — no partial-looking success.
    expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions).toEqual([])
  })

  it('addBlendAdditions is a no-op with an empty input array', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Vessel', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await result.current.addBlendAdditions('ib1', 'b1', [])

    expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions).toEqual([])
    const infinityWrites = mockSaveUserDoc.mock.calls.filter(([, patch]) => (patch as Partial<UserDoc>).infinityBottles)
    expect(infinityWrites).toHaveLength(0)
  })

  it('deleteBlendAddition removes only the targeted addition, waiting for the write before updating local state', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      {
        id: 'ib1',
        name: 'Vessel',
        archived: false,
        createdAt: 1,
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            additions: [
              { id: 'a1', bottleName: 'Eagle Rare', amountMl: 60, date: '2026-01-01', createdAt: 1 },
              { id: 'a2', bottleName: 'Weller 12', amountMl: 40, date: '2026-01-02', createdAt: 2 },
            ],
            tastings: [],
          },
        ],
      },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions).toHaveLength(2))

    await result.current.deleteBlendAddition('ib1', 'b1', 'a1')

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions).toHaveLength(1))
    expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions[0]?.id).toBe('a2')
  })

  it('deleteBlendAddition leaves the addition in place if the Firestore write fails', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      {
        id: 'ib1',
        name: 'Vessel',
        archived: false,
        createdAt: 1,
        batches: [
          { id: 'b1', status: 'active', startedAt: 1, additions: [{ id: 'a1', bottleName: 'Eagle Rare', amountMl: 60, date: '2026-01-01', createdAt: 1 }], tastings: [] },
        ],
      },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)
    mockSaveUserDoc.mockRejectedValueOnce(new Error('write failed'))

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions).toHaveLength(1))

    await expect(result.current.deleteBlendAddition('ib1', 'b1', 'a1')).rejects.toThrow('write failed')
    expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.additions).toHaveLength(1)
  })

  it('addTasting / updateTasting / deleteTasting manage tastings on the given batch, cleaning up the photo on delete', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Vessel', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await result.current.addTasting('ib1', 'b1', {
      date: '2026-01-01',
      score: 8,
      noseAromas: ['Caramel'],
      palateFlavors: [],
      photoUrl: 'https://x/t.jpg',
      photoStoragePath: 'infinity-bottle-photos/user-1/1-t.jpg',
    })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.tastings).toHaveLength(1))
    const tastingId = result.current.userDoc.infinityBottles[0]!.batches[0]!.tastings[0]!.id

    await result.current.updateTasting('ib1', 'b1', tastingId, {
      date: '2026-01-01',
      score: 9,
      noseAromas: ['Caramel'],
      palateFlavors: [],
      photoUrl: 'https://x/t.jpg',
      photoStoragePath: 'infinity-bottle-photos/user-1/1-t.jpg',
    })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.tastings[0]?.score).toBe(9))

    await result.current.deleteTasting('ib1', 'b1', tastingId)
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.tastings).toHaveLength(0))
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('infinity-bottle-photos/user-1/1-t.jpg')
  })

  it('completeBatch marks the given batch complete without creating a new one', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'Vessel', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    await result.current.completeBatch('ib1', 'b1')

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(1))
    expect(result.current.userDoc.infinityBottles[0]?.batches[0]?.status).toBe('complete')
  })

  it('startNewBatch archives the current batch and starts a fresh empty active one when no carry-forward is given', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      {
        id: 'ib1',
        name: 'Vessel',
        archived: false,
        createdAt: 1,
        batches: [
          {
            id: 'b1',
            name: 'First Due',
            status: 'active',
            startedAt: 1,
            additions: [{ id: 'a1', bottleName: 'Eagle Rare', proof: 90, amountMl: 100, date: '2026-01-01', createdAt: 1 }],
            tastings: [],
          },
        ],
      },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(1))

    await result.current.startNewBatch('ib1', { name: 'Second Alarm' })

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(2))
    const [oldBatch, newBatch] = result.current.userDoc.infinityBottles[0]!.batches
    expect(oldBatch?.status).toBe('complete')
    // Never overwritten — its own additions are untouched.
    expect(oldBatch?.additions).toHaveLength(1)
    expect(newBatch?.status).toBe('active')
    expect(newBatch?.name).toBe('Second Alarm')
    expect(newBatch?.additions).toEqual([])
  })

  it('startNewBatch with a carry-forward amount seeds the new batch with one addition snapshotting the old batch’s estimated proof', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      {
        id: 'ib1',
        name: 'Vessel',
        archived: false,
        createdAt: 1,
        batches: [
          {
            id: 'b1',
            name: 'First Due',
            status: 'active',
            startedAt: 1,
            additions: [{ id: 'a1', bottleName: 'Eagle Rare', proof: 90, amountMl: 100, date: '2026-01-01', createdAt: 1 }],
            tastings: [],
          },
        ],
      },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(1))

    await result.current.startNewBatch('ib1', { carryForwardMl: 30 })

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(2))
    const newBatch = result.current.userDoc.infinityBottles[0]!.batches[1]!
    expect(newBatch.additions).toHaveLength(1)
    expect(newBatch.additions[0]?.amountMl).toBe(30)
    expect(newBatch.additions[0]?.proof).toBe(90)
    expect(newBatch.additions[0]?.bottleName).toContain('Carried forward')
  })

  it('startNewBatch carries forward an undefined proof (never fabricated) when the old batch’s own estimate was incomplete', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      {
        id: 'ib1',
        name: 'Vessel',
        archived: false,
        createdAt: 1,
        batches: [
          {
            id: 'b1',
            status: 'active',
            startedAt: 1,
            // No proof snapshot — the old batch's own estimate is incomplete.
            additions: [{ id: 'a1', bottleName: 'Eagle Rare', amountMl: 100, date: '2026-01-01', createdAt: 1 }],
            tastings: [],
          },
        ],
      },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(1))

    await result.current.startNewBatch('ib1', { carryForwardMl: 30 })

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(2))
    expect(result.current.userDoc.infinityBottles[0]?.batches[1]?.additions[0]?.proof).toBeUndefined()
  })
})

describe('useUserData — legacy Infinity Bottle migration on load', () => {
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

  // A legacy, pre-batch record shaped exactly like production data written
  // by the old InfinityBottleButton — no `batches`, no `archived`, no
  // `createdAt`, a flat `additions` array with free-text `amount`.
  function legacyDocFixture(): UserDoc {
    const doc = emptyDoc()
    doc.infinityBottles = [
      {
        id: 'legacy-ib-1',
        name: 'Backdraft Batch',
        notes: 'started with leftovers',
        additions: [
          { bottleId: 'src1', name: 'Eagle Rare 10 Year', amount: '2 oz', date: '2025-01-01' },
          { bottleId: 'src2', name: 'Weller Special Reserve', amount: '60ml', date: '2025-02-01' },
        ],
        // Intentionally no `batches`, `archived`, or `createdAt` — the exact
        // shape that used to crash every Infinity Bottle page on
        // `ib.batches.length`.
      } as unknown as UserDoc['infinityBottles'][number],
    ]
    return doc
  }

  it('normalizes a legacy record into batches before it ever reaches userDoc — no crash, no empty-looking blend', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(legacyDocFixture())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    const ib = result.current.userDoc.infinityBottles[0]!
    expect(ib.batches).toHaveLength(1)
    expect(ib.batches[0]?.additions).toHaveLength(2)
    expect(ib.batches[0]?.additions[0]?.bottleName).toBe('Eagle Rare 10 Year')
    expect(ib.batches[0]?.additions[0]?.sourceBottleId).toBe('src1')
  })

  it('persists the migrated shape back to Firestore exactly once', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(legacyDocFixture())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(1))

    await waitFor(() => expect(mockSaveUserDoc).toHaveBeenCalled())
    const migrationCalls = mockSaveUserDoc.mock.calls.filter(([, patch]) => (patch as Partial<UserDoc>).infinityBottles)
    expect(migrationCalls).toHaveLength(1)

    const [uid, patch] = migrationCalls[0]!
    expect(uid).toBe('user-1')
    const migratedBottles = (patch as Partial<UserDoc>).infinityBottles!
    expect(migratedBottles[0]?.batches).toHaveLength(1)
    expect(migratedBottles[0]?.batches[0]?.additions).toHaveLength(2)
  })

  it('does not write anything when every Infinity Bottle record is already in the new format', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.infinityBottles = [
      { id: 'ib1', name: 'House Blend', archived: false, createdAt: 1, batches: [{ id: 'b1', status: 'active', startedAt: 1, additions: [], tastings: [] }] },
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Give any stray async migration write a chance to fire before asserting none did.
    await new Promise((resolve) => setTimeout(resolve, 0))
    const migrationCalls = mockSaveUserDoc.mock.calls.filter(([, patch]) => (patch as Partial<UserDoc>).infinityBottles)
    expect(migrationCalls).toHaveLength(0)
  })

  it('refreshing (re-fetching) after a successful migration does not migrate again', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValueOnce(legacyDocFixture())

    const { result, rerender } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(1))
    await waitFor(() => expect(mockSaveUserDoc).toHaveBeenCalledTimes(1))

    // Simulate a refresh: Firestore now serves back the already-migrated
    // doc (what the write above actually persisted).
    const migratedDoc: UserDoc = {
      ...emptyDoc(),
      infinityBottles: mockSaveUserDoc.mock.calls[0]![1].infinityBottles,
    }
    mockSaveUserDoc.mockClear()
    mockUseAuth.mockReturnValue({ user: { uid: 'user-2' }, loading: false })
    mockFetchUserDoc.mockResolvedValueOnce(migratedDoc)
    rerender()

    await waitFor(() => expect(result.current.userDoc.infinityBottles[0]?.batches).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockSaveUserDoc).not.toHaveBeenCalled()
  })

  it('does not crash and does not migrate when there are no Infinity Bottles at all', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(emptyDoc())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.userDoc.infinityBottles).toEqual([])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockSaveUserDoc).not.toHaveBeenCalled()
  })
})

// A user must be able to run multiple Infinity Bottles at once — this
// describe block is the regression suite for that guarantee. Every
// mutator here is expected to touch only the Infinity Bottle (and batch)
// it was given, leaving every sibling record byte-for-byte untouched.
describe('useUserData — multiple simultaneous active Infinity Bottles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadCachedUserDoc.mockReturnValue(undefined)
    mockFetchProfile.mockResolvedValue(undefined)
    mockEnsureSearchableProfile.mockImplementation((_uid: string, existing: unknown) => Promise.resolve(existing))
    mockSyncSharedCollection.mockResolvedValue(undefined)
    mockSaveUserDoc.mockResolvedValue(undefined)
    mockDeletePhotoIfSafe.mockResolvedValue(undefined)
  })

  function emptyDoc(): UserDoc {
    return { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] }
  }

  function threeBottleDoc(): UserDoc {
    const doc = emptyDoc()
    doc.infinityBottles = [
      {
        id: 'ib-a',
        name: 'Backdraft Batch',
        capacityMl: 1000,
        archived: false,
        createdAt: 1,
        batches: [{ id: 'batch-a', status: 'active', startedAt: 1, additions: [{ id: 'add-a1', bottleName: 'Eagle Rare', amountMl: 100, date: '2026-01-01', createdAt: 1 }], tastings: [] }],
      },
      {
        id: 'ib-b',
        name: 'House Blend #1',
        capacityMl: 750,
        archived: false,
        createdAt: 2,
        batches: [{ id: 'batch-b', status: 'active', startedAt: 2, additions: [{ id: 'add-b1', bottleName: 'Weller 12', amountMl: 200, date: '2026-01-01', createdAt: 1 }], tastings: [] }],
      },
      {
        id: 'ib-c',
        name: 'Rye Project',
        capacityMl: 750,
        archived: false,
        createdAt: 3,
        batches: [{ id: 'batch-c', status: 'active', startedAt: 3, additions: [{ id: 'add-c1', bottleName: 'Rittenhouse', amountMl: 150, date: '2026-01-01', createdAt: 1 }], tastings: [] }],
      },
    ]
    return doc
  }

  it('1-2-3: creating a first, second, and third Infinity Bottle appends each one, never replacing the array', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    mockFetchUserDoc.mockResolvedValue(emptyDoc())

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const idA = await result.current.createInfinityBottle({ name: 'Backdraft Batch' })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(1))

    const idB = await result.current.createInfinityBottle({ name: 'House Blend #1' })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(2))

    const idC = await result.current.createInfinityBottle({ name: 'Rye Project' })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))

    const ids = result.current.userDoc.infinityBottles.map((ib) => ib.id)
    expect(ids).toEqual([idA, idB, idC])
    expect(result.current.userDoc.infinityBottles.map((ib) => ib.name)).toEqual(['Backdraft Batch', 'House Blend #1', 'Rye Project'])
    // Every one of the three stays active — creating C never archived A or B.
    expect(result.current.userDoc.infinityBottles.every((ib) => !ib.archived)).toBe(true)
  })

  it('4-5: a third Infinity Bottle can be added on top of two existing ones without disturbing them', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = threeBottleDoc()
    const [a, b] = doc.infinityBottles
    doc.infinityBottles = [a!, b!]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(2))

    await result.current.createInfinityBottle({ name: 'Rye Project' })

    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))
    expect(result.current.userDoc.infinityBottles[0]).toEqual(a)
    expect(result.current.userDoc.infinityBottles[1]).toEqual(b)
    expect(result.current.userDoc.infinityBottles[2]?.name).toBe('Rye Project')
  })

  it('6: Add to Blend (addBlendAdditions) on bottle A does not change bottle B or C', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = threeBottleDoc()
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))
    const before = result.current.userDoc.infinityBottles

    await result.current.addBlendAdditions('ib-a', 'batch-a', [
      {
        sourceBottleId: 'src-weller107',
        bottleName: 'Weller 107',
        amountMl: 60,
        date: '2026-02-01',
      },
    ])

    await waitFor(() => expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-a')?.batches[0]?.additions).toHaveLength(2))
    const afterA = result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-a')!
    expect(afterA.batches[0]?.additions.some((a) => a.bottleName === 'Weller 107')).toBe(true)

    const afterB = result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-b')!
    const afterC = result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-c')!
    expect(afterB).toEqual(before.find((ib) => ib.id === 'ib-b'))
    expect(afterC).toEqual(before.find((ib) => ib.id === 'ib-c'))
  })

  it('7: a tasting logged on bottle B does not appear under bottle A or C', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = threeBottleDoc()
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))

    await result.current.addTasting('ib-b', 'batch-b', {
      date: '2026-02-01',
      score: 8,
      noseAromas: [],
      palateFlavors: [],
    })

    await waitFor(() => expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-b')?.batches[0]?.tastings).toHaveLength(1))
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-a')?.batches[0]?.tastings).toEqual([])
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-c')?.batches[0]?.tastings).toEqual([])
  })

  it('8: archiving bottle A does not archive B or C', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = threeBottleDoc()
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))

    await result.current.archiveInfinityBottle('ib-a', true)

    await waitFor(() => expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-a')?.archived).toBe(true))
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-b')?.archived).toBe(false)
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-c')?.archived).toBe(false)
  })

  it('9: starting a new batch on A does not modify B or C in any way', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = threeBottleDoc()
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))
    const before = result.current.userDoc.infinityBottles

    await result.current.startNewBatch('ib-a', {})

    await waitFor(() => expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-a')?.batches).toHaveLength(2))
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-b')).toEqual(before.find((ib) => ib.id === 'ib-b'))
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-c')).toEqual(before.find((ib) => ib.id === 'ib-c'))
  })

  it('10: deleting bottle A leaves B and C completely untouched', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = threeBottleDoc()
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))
    const before = result.current.userDoc.infinityBottles

    await result.current.deleteInfinityBottle('ib-a')

    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(2))
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-a')).toBeUndefined()
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-b')).toEqual(before.find((ib) => ib.id === 'ib-b'))
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-c')).toEqual(before.find((ib) => ib.id === 'ib-c'))
  })

  it('11: refetching (simulating a refresh) preserves all three Infinity Bottles exactly', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = threeBottleDoc()
    mockFetchUserDoc.mockResolvedValueOnce(doc)

    const { result, rerender } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))

    mockUseAuth.mockReturnValue({ user: { uid: 'user-2' }, loading: false })
    mockFetchUserDoc.mockResolvedValueOnce(threeBottleDoc())
    rerender()

    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))
    expect(result.current.userDoc.infinityBottles.map((ib) => ib.id)).toEqual(['ib-a', 'ib-b', 'ib-c'])
  })

  it('13: no mutator reaches into infinityBottles[0] — every mutation is scoped strictly by the id argument passed in', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = threeBottleDoc()
    // Reorder so ib-c is at index 0 — if any mutator secretly used
    // infinityBottles[0] instead of the id argument, this would catch it.
    doc.infinityBottles = [doc.infinityBottles[2]!, doc.infinityBottles[0]!, doc.infinityBottles[1]!]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.infinityBottles).toHaveLength(3))

    await result.current.updateInfinityBottle('ib-b', { name: 'Renamed Blend' })
    await waitFor(() => expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-b')?.name).toBe('Renamed Blend'))

    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-a')?.name).toBe('Backdraft Batch')
    expect(result.current.userDoc.infinityBottles.find((ib) => ib.id === 'ib-c')?.name).toBe('Rye Project')
  })
})

describe('useUserData — Bottle Instances', () => {
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

  function multiInstanceBottle(overrides: Partial<Bottle> = {}): Bottle {
    return {
      id: 'bt1',
      name: 'Eagle Rare',
      status: 'open',
      createdAt: 1,
      instances: [
        { id: 'i1', status: 'open', price: 39.99, storeLocation: 'ABC Store', purchaseDate: '2026-08-15', openedDate: '2026-08-18', createdAt: 1 },
        { id: 'i2', status: 'sealed', createdAt: 2 },
        { id: 'i3', status: 'sealed', createdAt: 3 },
      ],
      activeInstanceId: 'i1',
      quantity: 3,
      ...overrides,
    }
  }

  it('addBottleInstance appends a new sealed instance and recomputes quantity', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [multiInstanceBottle()]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    const newId = await result.current.addBottleInstance('bt1')

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.instances).toHaveLength(4))
    expect(newId).toBeDefined()
    expect(result.current.userDoc.bottles[0]?.quantity).toBe(4)
    expect(result.current.userDoc.bottles[0]?.instances?.at(-1)).toMatchObject({ id: newId, status: 'sealed' })
  })

  it('updateBottleInstance patches one instance and recomputes the top-level rollup', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [multiInstanceBottle()]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.updateBottleInstance('bt1', 'i2', { status: 'open' })

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.instances?.find((i) => i.id === 'i2')?.status).toBe('open'))
    // Still rolls up to 'open' overall (was already open via i1) — unaffected by this change.
    expect(result.current.userDoc.bottles[0]?.status).toBe('open')
  })

  it('activeInstanceId never references a non-open instance once an active one is marked finished', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [multiInstanceBottle()]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.updateBottleInstance('bt1', 'i1', { status: 'finished', finishedDate: '2026-09-01' })

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.instances?.find((i) => i.id === 'i1')?.status).toBe('finished'))
    // No other instance is open, so activeInstanceId must be cleared, not left pointing at i1.
    expect(result.current.userDoc.bottles[0]?.activeInstanceId).toBeUndefined()
    expect(result.current.userDoc.bottles[0]?.status).toBe('sealed')
  })

  it('deleteBottleInstance writes to Firestore before committing local state and refuses to remove the last instance', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [multiInstanceBottle()]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.deleteBottleInstance('bt1', 'i3')
    await waitFor(() => expect(result.current.userDoc.bottles[0]?.instances).toHaveLength(2))
    expect(result.current.userDoc.bottles[0]?.quantity).toBe(2)

    await result.current.deleteBottleInstance('bt1', 'i2')
    await waitFor(() => expect(result.current.userDoc.bottles[0]?.instances).toHaveLength(1))

    await result.current.deleteBottleInstance('bt1', 'i1')
    // The last remaining instance is never removed via this mutator.
    expect(result.current.userDoc.bottles[0]?.instances).toHaveLength(1)
  })

  it('deleteBottleInstance-fails-safe: a rejected write leaves the instance in place locally', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [multiInstanceBottle()]
    mockFetchUserDoc.mockResolvedValue(doc)
    mockSaveUserDoc.mockRejectedValueOnce(new Error('offline'))

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await expect(result.current.deleteBottleInstance('bt1', 'i3')).rejects.toThrow('offline')
    expect(result.current.userDoc.bottles[0]?.instances).toHaveLength(3)
  })

  it('openBottleInstance opens a sealed instance, sets openedDate once, and becomes the active instance', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [multiInstanceBottle({ instances: [{ id: 'i1', status: 'sealed', createdAt: 1 }], activeInstanceId: undefined, status: 'sealed', quantity: 1 })]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.openBottleInstance('bt1', 'i1')

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.instances?.[0]?.status).toBe('open'))
    expect(result.current.userDoc.bottles[0]?.instances?.[0]?.openedDate).toBeTruthy()
    expect(result.current.userDoc.bottles[0]?.activeInstanceId).toBe('i1')
    expect(result.current.userDoc.bottles[0]?.status).toBe('open')
  })

  it('openNextBottleInstance opens the oldest sealed instance, not just any', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [
      multiInstanceBottle({
        instances: [
          { id: 'i1', status: 'finished', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 3 },
          { id: 'i3', status: 'sealed', createdAt: 2 },
        ],
        activeInstanceId: undefined,
        status: 'sealed',
      }),
    ]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.openNextBottleInstance('bt1')

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.activeInstanceId).toBe('i3'))
    expect(result.current.userDoc.bottles[0]?.instances?.find((i) => i.id === 'i3')?.status).toBe('open')
  })

  it('openNextBottleInstance does not implicitly finish the previously active instance', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [multiInstanceBottle()]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.openNextBottleInstance('bt1')

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.instances?.find((i) => i.id === 'i2')?.status).toBe('open'))
    // i1 (the previously active instance) is untouched — still open, not finished.
    expect(result.current.userDoc.bottles[0]?.instances?.find((i) => i.id === 'i1')?.status).toBe('open')
  })

  it('addPour on a multi-instance bottle opens the resolved instance, not the whole bottle blindly', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [multiInstanceBottle({ status: 'sealed', instances: [{ id: 'i1', status: 'sealed', createdAt: 1 }], activeInstanceId: undefined, quantity: 1 })]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.addPour({
      bottleId: 'bt1',
      bottleInstanceId: 'i1',
      date: '2026-09-01',
      rating: 8,
      fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.5, value: 1, total: 8, noseAromas: [], palateFlavors: [] },
    })

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.instances?.[0]?.status).toBe('open'))
    expect(result.current.userDoc.bottles[0]?.status).toBe('open')
    expect(result.current.userDoc.pours[0]?.bottleInstanceId).toBe('i1')
  })

  it('a plain quantity=1 bottle with no instances behaves exactly as before this feature', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, loading: false })
    const doc = emptyDoc()
    doc.bottles = [{ id: 'bt2', name: 'Weller 12', status: 'sealed', createdAt: 1 }]
    mockFetchUserDoc.mockResolvedValue(doc)

    const { result } = renderHook(() => useUserData(), { wrapper: UserDataProvider })
    await waitFor(() => expect(result.current.userDoc.bottles).toHaveLength(1))

    await result.current.addPour({
      bottleId: 'bt2',
      date: '2026-09-01',
      rating: 7,
      fip: { nose: 2, palate: 3, finish: 1, complexity: 0.5, value: 0.5, total: 7, noseAromas: [], palateFlavors: [] },
    })

    await waitFor(() => expect(result.current.userDoc.bottles[0]?.status).toBe('open'))
    expect(result.current.userDoc.bottles[0]?.instances).toBeUndefined()
    expect(result.current.userDoc.bottles[0]?.openedDate).toBe('2026-09-01')
  })
})
