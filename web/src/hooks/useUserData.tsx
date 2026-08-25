import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { updateProfile as updateAuthProfile } from 'firebase/auth'
import { useAuth } from './useAuth'
import { auth } from '../data/firebase'
import { EMPTY_USER_DOC, fetchUserDoc, saveUserDoc } from '../data/repositories/userDoc'
import { claimUsername as claimUsernameRepo } from '../data/repositories/username'
import { ensureSearchableProfile, fetchProfile, saveProfile as saveProfileRepo } from '../data/repositories/profile'
import { syncSharedCollection } from '../data/repositories/sharedCollections'
import { readCachedUserDoc, writeCachedUserDoc } from '../data/localCache'
import { isMockAuthEnabled } from '../data/devMode'
import { findMatchingPerson, normalizePersonName } from '../features/pourWizard/pourPeople'
import { deletePhotoIfSafe } from '../features/photoUpload/uploadPhoto'
import { deleteSharedMomentsForStory } from '../data/repositories/sharedMoments'
import { estimatedProof } from '../features/infinityBottle/selectors'
import { normalizeInfinityBottles } from '../features/infinityBottle/migrateInfinityBottle'
import {
  DEFAULT_PRIVACY_SETTINGS,
  type BlendAddition,
  type BlendGoal,
  type Bottle,
  type GalleryPhoto,
  type InfinityBatch,
  type InfinityBottle,
  type InfinityTasting,
  type Memory,
  type Pour,
  type PourAiSummary,
  type PourMemoryPhoto,
  type PourPerson,
  type Profile,
  type UserDoc,
} from '../data/types'

export type NewBottleInput = Omit<Bottle, 'id' | 'createdAt'>
export type BottlePatch = Partial<Omit<Bottle, 'id' | 'createdAt'>>
export type NewPourInput = Omit<Pour, 'id'>
export type PourPatch = Omit<Pour, 'id' | 'bottleId'>
export type NewMemoryInput = Omit<Memory, 'id' | 'createdAt'>
export type MemoryPatch = Omit<Memory, 'id' | 'createdAt'>
export type NewInfinityBottleInput = { name: string; capacityMl?: number; batchName?: string; batchGoal?: BlendGoal }
export type InfinityBottlePatch = Partial<Pick<InfinityBottle, 'name' | 'capacityMl' | 'photoUrl' | 'photoStoragePath'>>
export type NewBlendAdditionInput = Omit<BlendAddition, 'id' | 'createdAt'>
export type NewTastingInput = Omit<InfinityTasting, 'id' | 'createdAt'>
export type TastingPatch = Omit<InfinityTasting, 'id' | 'createdAt'>
export type StartNewBatchInput = { name?: string; goal?: BlendGoal; carryForwardMl?: number }
export type ProfilePatch = Partial<
  Pick<
    Profile,
    'displayName' | 'bio' | 'location' | 'photoURL' | 'photoStoragePath' | 'whiskeyIdentityTags' | 'whiskeyIdentityDescription' | 'privacy'
  >
>

interface UserDataState {
  userDoc: UserDoc
  profile: Profile | undefined
  profileLoading: boolean
  loading: boolean
  signedIn: boolean
  addBottle: (input: NewBottleInput) => Promise<string | undefined>
  updateBottle: (bottleId: string, patch: BottlePatch) => Promise<void>
  deleteBottle: (bottleId: string) => Promise<void>
  deleteBottles: (bottleIds: string[]) => Promise<void>
  addPour: (input: NewPourInput) => Promise<Pour | undefined>
  updatePour: (pourId: string, patch: PourPatch) => Promise<void>
  updatePourAiSummary: (pourId: string, aiSummary: PourAiSummary) => Promise<void>
  updatePourMemoryPhoto: (pourId: string, memoryPhoto: PourMemoryPhoto | undefined) => Promise<void>
  deletePour: (pourId: string) => Promise<void>
  addOrReusePerson: (name: string) => Promise<PourPerson | undefined>
  updatePersonPhoto: (personId: string, photo: { photoUrl: string; photoStoragePath?: string } | undefined) => Promise<void>
  addMemory: (input: NewMemoryInput) => Promise<void>
  updateMemory: (memoryId: string, patch: MemoryPatch) => Promise<void>
  deleteMemory: (memoryId: string) => Promise<void>
  addGalleryPhoto: (bottleId: string, photo: GalleryPhoto) => Promise<void>
  deleteGalleryPhoto: (bottleId: string, photoUrl: string) => Promise<void>
  createInfinityBottle: (input: NewInfinityBottleInput) => Promise<string | undefined>
  updateInfinityBottle: (id: string, patch: InfinityBottlePatch) => Promise<void>
  deleteInfinityBottle: (id: string) => Promise<void>
  archiveInfinityBottle: (id: string, archived: boolean) => Promise<void>
  addBlendAdditions: (infinityBottleId: string, batchId: string, inputs: NewBlendAdditionInput[]) => Promise<void>
  deleteBlendAddition: (infinityBottleId: string, batchId: string, additionId: string) => Promise<void>
  addTasting: (infinityBottleId: string, batchId: string, input: NewTastingInput) => Promise<void>
  updateTasting: (infinityBottleId: string, batchId: string, tastingId: string, patch: TastingPatch) => Promise<void>
  deleteTasting: (infinityBottleId: string, batchId: string, tastingId: string) => Promise<void>
  completeBatch: (infinityBottleId: string, batchId: string) => Promise<void>
  startNewBatch: (infinityBottleId: string, input: StartNewBatchInput) => Promise<void>
  claimUsername: (username: string) => Promise<void>
  updateProfile: (patch: ProfilePatch) => Promise<void>
}

const UserDataContext = createContext<UserDataState>({
  userDoc: EMPTY_USER_DOC,
  profile: undefined,
  profileLoading: true,
  loading: true,
  signedIn: false,
  addBottle: async () => {},
  updateBottle: async () => {},
  deleteBottle: async () => {},
  deleteBottles: async () => {},
  addPour: async () => undefined,
  updatePour: async () => {},
  updatePourAiSummary: async () => {},
  updatePourMemoryPhoto: async () => {},
  deletePour: async () => {},
  addOrReusePerson: async () => undefined,
  updatePersonPhoto: async () => {},
  addMemory: async () => {},
  updateMemory: async () => {},
  deleteMemory: async () => {},
  addGalleryPhoto: async () => {},
  deleteGalleryPhoto: async () => {},
  createInfinityBottle: async () => undefined,
  updateInfinityBottle: async () => {},
  deleteInfinityBottle: async () => {},
  archiveInfinityBottle: async () => {},
  addBlendAdditions: async () => {},
  deleteBlendAddition: async () => {},
  addTasting: async () => {},
  updateTasting: async () => {},
  deleteTasting: async () => {},
  completeBatch: async () => {},
  startNewBatch: async () => {},
  claimUsername: async () => {},
  updateProfile: async () => {},
})

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Every load path (mock fixture, local-storage bootstrap cache, and the
// real Firestore fetch) runs through here before the doc ever reaches
// setUserDoc/rendering — guarantees no page ever sees an Infinity Bottle
// record without a real `batches` array, whether it's the pre-batch legacy
// shape or just missing an optional field. `migrated` tells the caller
// whether the *raw* record needed a real one-time conversion (legacy
// shape) — never true for an already-batches-shaped record that only had
// a sparse field filled in — so callers know when a Firestore write-back
// is actually warranted.
function withNormalizedInfinityBottles(doc: UserDoc): { doc: UserDoc; migrated: boolean } {
  const { infinityBottles, migrated } = normalizeInfinityBottles(doc.infinityBottles)
  return { doc: { ...doc, infinityBottles }, migrated }
}

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const mockMode = isMockAuthEnabled()
  const [userDoc, setUserDoc] = useState<UserDoc>(EMPTY_USER_DOC)
  const [dataLoading, setDataLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [profileLoading, setProfileLoading] = useState(true)
  const previousUidRef = useRef<string | null>(null)
  const previousProfileUidRef = useRef<string | null>(null)
  // Read by the profile-loading effect below without adding userDoc to its
  // own dependency array (which would re-run it on every bottle/pour edit).
  const userDocRef = useRef<UserDoc>(userDoc)
  userDocRef.current = userDoc

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setUserDoc(EMPTY_USER_DOC)
      setDataLoading(false)
      previousUidRef.current = null
      return
    }

    // A direct switch from one signed-in account to another (no intervening
    // signed-out render — e.g. an in-app account switcher) skips the !user
    // branch above, which is the only place this state otherwise gets
    // cleared. Without this, the previous user's bottles/pours would keep
    // rendering for the length of the fetch below.
    if (previousUidRef.current !== null && previousUidRef.current !== user.uid) {
      setUserDoc(EMPTY_USER_DOC)
    }
    previousUidRef.current = user.uid

    if (mockMode) {
      let cancelled = false
      import('../data/mockData').then(({ MOCK_USER_DOC }) => {
        if (cancelled) return
        setUserDoc(withNormalizedInfinityBottles(MOCK_USER_DOC).doc)
        setDataLoading(false)
      })
      return () => {
        cancelled = true
      }
    }

    const cached = readCachedUserDoc(user.uid)
    if (cached) {
      // Defensive-only here — never persisted. The cache is a fast bootstrap
      // paint; the real Firestore fetch below is the one that decides
      // whether a migration write-back is actually needed.
      setUserDoc(withNormalizedInfinityBottles(cached).doc)
      setDataLoading(false)
    } else {
      setDataLoading(true)
    }

    let cancelled = false
    fetchUserDoc(user.uid).then((doc) => {
      if (cancelled) return
      const { doc: normalized, migrated } = withNormalizedInfinityBottles(doc)
      setUserDoc(normalized)
      setDataLoading(false)
      writeCachedUserDoc(user.uid, normalized)
      // One-time, idempotent migration write-back for legacy Infinity
      // Bottle records — fire-and-forget (same best-effort convention as
      // deletePhotoIfSafe elsewhere) so a slow/failed write never blocks
      // the page; if it fails, normalization still protects rendering and
      // the next load simply retries.
      if (migrated) {
        void saveUserDoc(user.uid, { infinityBottles: normalized.infinityBottles }).catch((err) => {
          console.error('Infinity Bottle migration write failed', err)
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [user, authLoading, mockMode])

  // profiles/{uid} — public displayName/bio/location/photoURL, fetched
  // separately from userDoc since it's a different Firestore document (see
  // data/repositories/profile.ts). Username itself is NOT mirrored here —
  // userDoc.username (above) stays the single source of truth for that,
  // same as it already was before this profile doc existed.
  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setProfile(undefined)
      setProfileLoading(false)
      previousProfileUidRef.current = null
      return
    }

    if (previousProfileUidRef.current !== null && previousProfileUidRef.current !== user.uid) {
      setProfile(undefined)
    }
    previousProfileUidRef.current = user.uid

    if (mockMode) {
      setProfile({ username: '', displayName: user.displayName ?? undefined })
      setProfileLoading(false)
      return
    }

    let cancelled = false
    setProfileLoading(true)
    fetchProfile(user.uid).then(async (fetched) => {
      if (cancelled) return
      // Creates a searchable public profile for a brand-new signup or an
      // account that predates this system, OR repairs one that exists but
      // is missing/stale on the normalized fields Friend Search actually
      // queries — see ensureSearchableProfile's own comment for why "the
      // profile exists" isn't the same as "it's findable." A no-op (returns
      // fetched unchanged) in the common case where nothing needs fixing.
      // Failures are logged and simply retried the next time this effect
      // runs (e.g. next app load) rather than blocking the rest of sign-in.
      let p = fetched
      try {
        p = await ensureSearchableProfile(user.uid, fetched, {
          preferredUsername: userDocRef.current.username,
          displayName: user.displayName ?? undefined,
          photoURL: user.photoURL ?? undefined,
        })
      } catch (err) {
        console.error('ensureSearchableProfile failed', err)
      }
      if (cancelled) return
      setProfile(p)
      setProfileLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user, authLoading, mockMode])

  // The shared-collection projection friends see (see
  // data/repositories/sharedCollections.ts) previously only refreshed when
  // the owner changed a privacy setting, or visited their own Profile page
  // — neither of which most signed-in sessions ever do, so it could sit
  // permanently empty for an account that had already opted into sharing.
  // This fires once per sign-in, as soon as both userDoc and profile have
  // actually finished loading (not on every keystroke of a bottle edit —
  // userDoc/profile only change reference when their real data changes).
  useEffect(() => {
    if (!user || mockMode || dataLoading || profileLoading) return
    void syncSharedCollection(user.uid, userDoc, profile?.privacy ?? DEFAULT_PRIVACY_SETTINGS)
  }, [user, mockMode, dataLoading, profileLoading, userDoc, profile?.privacy])

  const addBottle = useCallback(
    async (input: NewBottleInput) => {
      if (!user) return undefined
      const bottle: Bottle = { ...input, id: generateId(), createdAt: Date.now() }
      const nextBottles = [...userDoc.bottles, bottle]
      const nextDoc: UserDoc = { ...userDoc, bottles: nextBottles }
      setUserDoc(nextDoc)
      if (mockMode) return bottle.id // dev fixture data — never touches Firestore
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { bottles: nextBottles })
      return bottle.id
    },
    [user, userDoc, mockMode],
  )

  const updateBottle = useCallback(
    async (bottleId: string, patch: BottlePatch) => {
      if (!user) return
      const nextBottles = userDoc.bottles.map((b) => (b.id === bottleId ? { ...b, ...patch } : b))
      const nextDoc: UserDoc = { ...userDoc, bottles: nextBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { bottles: nextBottles })
    },
    [user, userDoc, mockMode],
  )

  const deleteBottles = useCallback(
    async (bottleIds: string[]) => {
      if (!user || bottleIds.length === 0) return
      const idSet = new Set(bottleIds)
      const removedBottles = userDoc.bottles.filter((b) => idSet.has(b.id))
      const nextBottles = userDoc.bottles.filter((b) => !idSet.has(b.id))
      // Pour Stories are meaningless without their bottle — every render
      // path (Home, Journal, Compare) looks the bottle up and skips the
      // pour entirely if it's missing, so leaving them behind would just
      // silently orphan them. Memories keep an optional bottleId and
      // already render fine without a linked bottle, so they're untouched.
      const removedPours = userDoc.pours.filter((p) => idSet.has(p.bottleId))
      const nextPours = userDoc.pours.filter((p) => !idSet.has(p.bottleId))
      const nextDoc: UserDoc = { ...userDoc, bottles: nextBottles, pours: nextPours }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { bottles: nextBottles, pours: nextPours })
      // Best-effort — never blocks the delete itself, and a failure here
      // just leaves an orphaned Storage file rather than losing user data.
      for (const bottle of removedBottles) {
        void deletePhotoIfSafe(bottle.imageStoragePath)
        void deletePhotoIfSafe(bottle.originalImageStoragePath)
        for (const photo of bottle.gallery ?? []) void deletePhotoIfSafe(photo.storagePath)
      }
      for (const pour of removedPours) {
        void deletePhotoIfSafe(pour.memoryPhoto?.storagePath)
        void deleteSharedMomentsForStory(pour.id, user.uid)
      }
    },
    [user, userDoc, mockMode],
  )

  const deleteBottle = useCallback((bottleId: string) => deleteBottles([bottleId]), [deleteBottles])

  const addPour = useCallback(
    async (input: NewPourInput) => {
      if (!user) return undefined
      const pour: Pour = { ...input, id: generateId() }
      const nextPours = [...userDoc.pours, pour]

      // Logging a pour on a still-sealed bottle marks it opened — a real
      // product behavior (not a schema change), using existing fields only.
      const nextBottles = userDoc.bottles.map((bottle) => {
        if (bottle.id !== pour.bottleId || bottle.status !== 'sealed') return bottle
        return { ...bottle, status: 'open' as const, openedDate: bottle.openedDate ?? pour.date }
      })

      const nextDoc: UserDoc = { ...userDoc, pours: nextPours, bottles: nextBottles }
      setUserDoc(nextDoc)
      if (mockMode) return pour // dev fixture data — never touches Firestore
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { pours: nextPours, bottles: nextBottles })
      return pour
    },
    [user, userDoc, mockMode],
  )

  const updatePour = useCallback(
    async (pourId: string, patch: PourPatch) => {
      if (!user) return
      const nextPours = userDoc.pours.map((p) => (p.id === pourId ? { ...p, ...patch } : p))
      const nextDoc: UserDoc = { ...userDoc, pours: nextPours }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { pours: nextPours })
    },
    [user, userDoc, mockMode],
  )

  // Merges in a background-generated AI tasting summary once it resolves —
  // deliberately reads userDocRef.current (not the closed-over `userDoc`)
  // because this fires from a fire-and-forget call kicked off at pour-save
  // time (see features/pourWizard/tastingSummaryOnSave.ts) that may resolve
  // well after the triggering component has unmounted; using the ref keeps
  // this correct against whatever the freshest pours array is by then,
  // instead of silently reverting other edits made in the meantime.
  const updatePourAiSummary = useCallback(
    async (pourId: string, aiSummary: PourAiSummary) => {
      if (!user) return
      const current = userDocRef.current
      const nextPours = current.pours.map((p) => (p.id === pourId ? { ...p, aiSummary } : p))
      const nextDoc: UserDoc = { ...current, pours: nextPours }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { pours: nextPours })
    },
    [user, mockMode],
  )

  // Merges in a background-uploaded memory photo (or clears one) once it
  // resolves — same userDocRef.current freshness fix as updatePourAiSummary
  // above, for the same reason: this fires from a fire-and-forget upload
  // kicked off at pour-save time (see PourWizard.tsx) that may resolve
  // after the wizard has already unmounted.
  const updatePourMemoryPhoto = useCallback(
    async (pourId: string, memoryPhoto: PourMemoryPhoto | undefined) => {
      if (!user) return
      const current = userDocRef.current
      const nextPours = current.pours.map((p) => (p.id === pourId ? { ...p, memoryPhoto } : p))
      const nextDoc: UserDoc = { ...current, pours: nextPours }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { pours: nextPours })
    },
    [user, mockMode],
  )

  const deletePour = useCallback(
    async (pourId: string) => {
      if (!user) return
      const removedPour = userDoc.pours.find((p) => p.id === pourId)
      const nextPours = userDoc.pours.filter((p) => p.id !== pourId)
      const nextDoc: UserDoc = { ...userDoc, pours: nextPours }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { pours: nextPours })
      // Best-effort — never blocks the delete itself. Also cleans up any
      // SharedMoment this pour was shared into, so deleting a Pour doesn't
      // leave a friend-visible copy referencing a story that no longer
      // exists (see sharedMoments.ts deleteSharedMomentsForStory).
      void deletePhotoIfSafe(removedPour?.memoryPhoto?.storagePath)
      void deleteSharedMomentsForStory(pourId, user.uid)
    },
    [user, userDoc, mockMode],
  )

  // Reuses an existing "Poured With" contact by normalized-name match
  // (see features/pourWizard/pourPeople.ts) so "Marcus" and " marcus " never
  // create two records; only creates a new one when nothing matches.
  const addOrReusePerson = useCallback(
    async (name: string) => {
      if (!user) return undefined
      const existing = findMatchingPerson(userDoc.people, name)
      if (existing) return existing

      const trimmed = name.trim()
      if (!trimmed) return undefined

      const person: PourPerson = { id: generateId(), name: trimmed, normalizedName: normalizePersonName(trimmed), createdAt: Date.now() }
      const nextPeople = [...userDoc.people, person]
      const nextDoc: UserDoc = { ...userDoc, people: nextPeople }
      setUserDoc(nextDoc)
      if (mockMode) return person // dev fixture data — never touches Firestore
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { people: nextPeople })
      return person
    },
    [user, userDoc, mockMode],
  )

  const updatePersonPhoto = useCallback(
    async (personId: string, photo: { photoUrl: string; photoStoragePath?: string } | undefined) => {
      if (!user) return
      const nextPeople = userDoc.people.map((p) =>
        p.id === personId ? { ...p, photoUrl: photo?.photoUrl, photoStoragePath: photo?.photoStoragePath } : p,
      )
      const nextDoc: UserDoc = { ...userDoc, people: nextPeople }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { people: nextPeople })
    },
    [user, userDoc, mockMode],
  )

  const addMemory = useCallback(
    async (input: NewMemoryInput) => {
      if (!user) return
      const memory: Memory = { ...input, id: generateId(), createdAt: Date.now() }
      const nextMemories = [...userDoc.memories, memory]
      const nextDoc: UserDoc = { ...userDoc, memories: nextMemories }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { memories: nextMemories })
    },
    [user, userDoc, mockMode],
  )

  const updateMemory = useCallback(
    async (memoryId: string, patch: MemoryPatch) => {
      if (!user) return
      const nextMemories = userDoc.memories.map((m) => (m.id === memoryId ? { ...m, ...patch } : m))
      const nextDoc: UserDoc = { ...userDoc, memories: nextMemories }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { memories: nextMemories })
    },
    [user, userDoc, mockMode],
  )

  const deleteMemory = useCallback(
    async (memoryId: string) => {
      if (!user) return
      const removedMemory = userDoc.memories.find((m) => m.id === memoryId)
      const nextMemories = userDoc.memories.filter((m) => m.id !== memoryId)
      const nextDoc: UserDoc = { ...userDoc, memories: nextMemories }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { memories: nextMemories })
      void deletePhotoIfSafe(removedMemory?.photoStoragePath)
    },
    [user, userDoc, mockMode],
  )

  const addGalleryPhoto = useCallback(
    async (bottleId: string, photo: GalleryPhoto) => {
      if (!user) return
      const nextBottles = userDoc.bottles.map((b) => (b.id === bottleId ? { ...b, gallery: [...(b.gallery ?? []), photo] } : b))
      const nextDoc: UserDoc = { ...userDoc, bottles: nextBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { bottles: nextBottles })
    },
    [user, userDoc, mockMode],
  )

  const deleteGalleryPhoto = useCallback(
    async (bottleId: string, photoUrl: string) => {
      if (!user) return
      const bottle = userDoc.bottles.find((b) => b.id === bottleId)
      const removedPhoto = bottle?.gallery?.find((p) => p.url === photoUrl)
      const nextBottles = userDoc.bottles.map((b) =>
        b.id === bottleId ? { ...b, gallery: (b.gallery ?? []).filter((p) => p.url !== photoUrl) } : b,
      )
      const nextDoc: UserDoc = { ...userDoc, bottles: nextBottles }
      // Deliberately NOT optimistic, unlike most other mutators here: the
      // Firestore write is awaited FIRST, and local state only updates once
      // it actually succeeds. A delete is exactly the case where showing
      // "gone" before it's actually persisted is worse than a brief wait —
      // if the write fails, the photo must still be there after a refresh,
      // not just missing from a stale local render (see GalleryTab.tsx,
      // which surfaces a retryable error on failure instead of silently
      // leaving the UI ahead of Firestore).
      if (!mockMode) {
        await saveUserDoc(user.uid, { bottles: nextBottles })
        writeCachedUserDoc(user.uid, nextDoc)
      }
      setUserDoc(nextDoc)
      if (mockMode) return
      void deletePhotoIfSafe(removedPhoto?.storagePath)
    },
    [user, userDoc, mockMode],
  )

  const createInfinityBottle = useCallback(
    async (input: NewInfinityBottleInput) => {
      if (!user) return undefined
      const now = Date.now()
      const batch: InfinityBatch = {
        id: generateId(),
        name: input.batchName,
        goal: input.batchGoal,
        status: 'active',
        startedAt: now,
        additions: [],
        tastings: [],
      }
      const infinityBottle: InfinityBottle = {
        id: generateId(),
        name: input.name,
        capacityMl: input.capacityMl,
        archived: false,
        createdAt: now,
        batches: [batch],
      }
      const nextInfinityBottles = [...userDoc.infinityBottles, infinityBottle]
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return infinityBottle.id // dev fixture data — never touches Firestore
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
      return infinityBottle.id
    },
    [user, userDoc, mockMode],
  )

  const updateInfinityBottle = useCallback(
    async (id: string, patch: InfinityBottlePatch) => {
      if (!user) return
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) => (ib.id === id ? { ...ib, ...patch } : ib))
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
    },
    [user, userDoc, mockMode],
  )

  const archiveInfinityBottle = useCallback(
    async (id: string, archived: boolean) => {
      if (!user) return
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) => (ib.id === id ? { ...ib, archived } : ib))
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
    },
    [user, userDoc, mockMode],
  )

  // Deletes never touch bottles[] — additions only ever snapshot a source
  // bottle, they don't own it — and, like deleteGalleryPhoto, wait for the
  // write to succeed before touching local state so a failed save can never
  // leave something looking deleted until a refresh brings it back.
  const deleteInfinityBottle = useCallback(
    async (id: string) => {
      if (!user) return
      const removed = userDoc.infinityBottles.find((ib) => ib.id === id)
      const nextInfinityBottles = userDoc.infinityBottles.filter((ib) => ib.id !== id)
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      if (!mockMode) {
        await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
        writeCachedUserDoc(user.uid, nextDoc)
      }
      setUserDoc(nextDoc)
      if (mockMode) return
      void deletePhotoIfSafe(removed?.photoStoragePath)
      for (const batch of removed?.batches ?? []) {
        for (const tasting of batch.tastings) void deletePhotoIfSafe(tasting.photoStoragePath)
      }
    },
    [user, userDoc, mockMode],
  )

  // Adds every input as its own BlendAddition in ONE saveUserDoc write — the
  // atomic multi-select "Add to Blend" needs N separate source-bottle
  // records without N separate writes that could partially succeed.
  // createdAt is staggered by index so same-day additions keep their
  // selection order in the (date, createdAt) timeline/composition sort,
  // without needing any changes to those selectors.
  //
  // Write-before-commit (opposite of most create mutators in this file, but
  // matching the delete-mutator convention already used elsewhere): a failed
  // write must never leave local state showing additions that were never
  // persisted, which matters more here than for a single create since a
  // failed 5-bottle save silently "sticking" locally would be confusing.
  const addBlendAdditions = useCallback(
    async (infinityBottleId: string, batchId: string, inputs: NewBlendAdditionInput[]) => {
      if (!user || inputs.length === 0) return
      const now = Date.now()
      const additions: BlendAddition[] = inputs.map((input, i) => ({ ...input, id: generateId(), createdAt: now + i }))
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) =>
        ib.id === infinityBottleId
          ? { ...ib, batches: ib.batches.map((b) => (b.id === batchId ? { ...b, additions: [...b.additions, ...additions] } : b)) }
          : ib,
      )
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      if (mockMode) {
        setUserDoc(nextDoc) // dev fixture data — never touches Firestore, safe to commit immediately
        return
      }
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
      setUserDoc(nextDoc)
      writeCachedUserDoc(user.uid, nextDoc)
    },
    [user, userDoc, mockMode],
  )

  const deleteBlendAddition = useCallback(
    async (infinityBottleId: string, batchId: string, additionId: string) => {
      if (!user) return
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) =>
        ib.id === infinityBottleId
          ? {
              ...ib,
              batches: ib.batches.map((b) =>
                b.id === batchId ? { ...b, additions: b.additions.filter((a) => a.id !== additionId) } : b,
              ),
            }
          : ib,
      )
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      if (!mockMode) {
        await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
        writeCachedUserDoc(user.uid, nextDoc)
      }
      setUserDoc(nextDoc)
    },
    [user, userDoc, mockMode],
  )

  const addTasting = useCallback(
    async (infinityBottleId: string, batchId: string, input: NewTastingInput) => {
      if (!user) return
      const tasting: InfinityTasting = { ...input, id: generateId(), createdAt: Date.now() }
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) =>
        ib.id === infinityBottleId
          ? { ...ib, batches: ib.batches.map((b) => (b.id === batchId ? { ...b, tastings: [...b.tastings, tasting] } : b)) }
          : ib,
      )
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
    },
    [user, userDoc, mockMode],
  )

  const updateTasting = useCallback(
    async (infinityBottleId: string, batchId: string, tastingId: string, patch: TastingPatch) => {
      if (!user) return
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) =>
        ib.id === infinityBottleId
          ? {
              ...ib,
              batches: ib.batches.map((b) =>
                b.id === batchId ? { ...b, tastings: b.tastings.map((t) => (t.id === tastingId ? { ...t, ...patch } : t)) } : b,
              ),
            }
          : ib,
      )
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
    },
    [user, userDoc, mockMode],
  )

  const deleteTasting = useCallback(
    async (infinityBottleId: string, batchId: string, tastingId: string) => {
      if (!user) return
      const batch = userDoc.infinityBottles.find((ib) => ib.id === infinityBottleId)?.batches.find((b) => b.id === batchId)
      const removedTasting = batch?.tastings.find((t) => t.id === tastingId)
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) =>
        ib.id === infinityBottleId
          ? {
              ...ib,
              batches: ib.batches.map((b) =>
                b.id === batchId ? { ...b, tastings: b.tastings.filter((t) => t.id !== tastingId) } : b,
              ),
            }
          : ib,
      )
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      if (!mockMode) {
        await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
        writeCachedUserDoc(user.uid, nextDoc)
      }
      setUserDoc(nextDoc)
      if (mockMode) return
      void deletePhotoIfSafe(removedTasting?.photoStoragePath)
    },
    [user, userDoc, mockMode],
  )

  // Archives the current batch (status: 'complete', never edited again) and
  // starts a fresh active one. An optional carry-forward amount is recorded
  // as the new batch's own first BlendAddition — its proof snapshot reuses
  // the old batch's estimatedProof, which is itself undefined whenever that
  // batch's own proof data was incomplete, so "unknown" honestly propagates
  // forward instead of being silently invented.
  // "Archive This Batch" — retires the current batch (status: 'complete')
  // without starting a replacement, unlike startNewBatch below. The vessel
  // itself stays whatever archived state it already had.
  const completeBatch = useCallback(
    async (infinityBottleId: string, batchId: string) => {
      if (!user) return
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) =>
        ib.id === infinityBottleId
          ? {
              ...ib,
              batches: ib.batches.map((b) => (b.id === batchId ? { ...b, status: 'complete' as const, completedAt: Date.now() } : b)),
            }
          : ib,
      )
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
    },
    [user, userDoc, mockMode],
  )

  const startNewBatch = useCallback(
    async (infinityBottleId: string, input: StartNewBatchInput) => {
      if (!user) return
      const ib = userDoc.infinityBottles.find((b) => b.id === infinityBottleId)
      const current = ib?.batches[ib.batches.length - 1]
      if (!ib || !current) return
      const now = Date.now()
      const completedCurrent: InfinityBatch = { ...current, status: 'complete', completedAt: now }
      const carryForwardMl = input.carryForwardMl
      const carryAddition: BlendAddition | undefined =
        carryForwardMl && carryForwardMl > 0
          ? {
              id: generateId(),
              bottleName: `Carried forward from ${current.name ?? 'the previous batch'}`,
              proof: estimatedProof(current),
              amountMl: carryForwardMl,
              date: new Date().toISOString().slice(0, 10),
              createdAt: now,
            }
          : undefined
      const newBatch: InfinityBatch = {
        id: generateId(),
        name: input.name,
        goal: input.goal,
        status: 'active',
        startedAt: now,
        additions: carryAddition ? [carryAddition] : [],
        tastings: [],
      }
      const nextBatches = [...ib.batches.slice(0, -1), completedCurrent, newBatch]
      const nextInfinityBottles = userDoc.infinityBottles.map((b) => (b.id === infinityBottleId ? { ...b, batches: nextBatches } : b))
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
    },
    [user, userDoc, mockMode],
  )

  const claimUsername = useCallback(
    async (username: string) => {
      if (!user) return
      if (!mockMode) {
        await claimUsernameRepo(user.uid, username)
      }
      const nextDoc: UserDoc = { ...userDoc, username }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { username })
    },
    [user, userDoc, mockMode],
  )

  // Updates the public profiles/{uid} doc (displayName/bio/location/
  // photoURL). When displayName changes, also mirrors it into
  // userDoc.greetingName — the field Home already reads for its greeting
  // (see pages/Home/HomePage.tsx) — and into Firebase Auth's own
  // displayName/photoURL via updateProfile(), so both stay in sync with
  // whatever the rest of the app already reads off the Auth user object.
  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!user) return
      const nextProfile: Profile = { ...(profile ?? { username: userDoc.username ?? '' }), ...patch }
      setProfile(nextProfile)

      if (patch.displayName !== undefined && patch.displayName !== userDoc.greetingName) {
        const nextDoc: UserDoc = { ...userDoc, greetingName: patch.displayName }
        setUserDoc(nextDoc)
        if (!mockMode) {
          writeCachedUserDoc(user.uid, nextDoc)
          await saveUserDoc(user.uid, { greetingName: patch.displayName })
        }
      }

      if (mockMode) return

      await saveProfileRepo(user.uid, patch)

      if (auth.currentUser && (patch.displayName !== undefined || patch.photoURL !== undefined)) {
        await updateAuthProfile(auth.currentUser, {
          ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
          ...(patch.photoURL !== undefined ? { photoURL: patch.photoURL } : {}),
        })
      }
    },
    [user, userDoc, profile, mockMode],
  )

  const value = useMemo<UserDataState>(
    () => ({
      userDoc,
      profile,
      profileLoading,
      loading: authLoading || dataLoading,
      signedIn: Boolean(user),
      addBottle,
      updateBottle,
      deleteBottle,
      deleteBottles,
      addPour,
      updatePour,
      updatePourAiSummary,
      updatePourMemoryPhoto,
      deletePour,
      addOrReusePerson,
      updatePersonPhoto,
      addMemory,
      updateMemory,
      deleteMemory,
      addGalleryPhoto,
      deleteGalleryPhoto,
      createInfinityBottle,
      updateInfinityBottle,
      deleteInfinityBottle,
      archiveInfinityBottle,
      addBlendAdditions,
      deleteBlendAddition,
      addTasting,
      updateTasting,
      deleteTasting,
      completeBatch,
      startNewBatch,
      claimUsername,
      updateProfile,
    }),
    [
      userDoc,
      profile,
      profileLoading,
      authLoading,
      dataLoading,
      user,
      addBottle,
      updateBottle,
      deleteBottle,
      deleteBottles,
      addPour,
      updatePour,
      updatePourAiSummary,
      updatePourMemoryPhoto,
      deletePour,
      addOrReusePerson,
      updatePersonPhoto,
      addMemory,
      updateMemory,
      deleteMemory,
      addGalleryPhoto,
      deleteGalleryPhoto,
      createInfinityBottle,
      updateInfinityBottle,
      deleteInfinityBottle,
      archiveInfinityBottle,
      addBlendAdditions,
      deleteBlendAddition,
      addTasting,
      updateTasting,
      deleteTasting,
      completeBatch,
      startNewBatch,
      claimUsername,
      updateProfile,
    ],
  )

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
}

export function useUserData(): UserDataState {
  return useContext(UserDataContext)
}

export function useBottles() {
  return useUserData().userDoc.bottles
}

export function usePours() {
  return useUserData().userDoc.pours
}
