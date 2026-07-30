import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { EMPTY_USER_DOC, fetchUserDoc, saveUserDoc } from '../data/repositories/userDoc'
import { readCachedUserDoc, writeCachedUserDoc } from '../data/localCache'
import { isMockAuthEnabled } from '../data/devMode'
import type { Bottle, GalleryPhoto, InfinityBottleAddition, Memory, Pour, UserDoc } from '../data/types'

export type NewBottleInput = Omit<Bottle, 'id' | 'createdAt'>
export type NewPourInput = Omit<Pour, 'id'>
export type PourPatch = Omit<Pour, 'id' | 'bottleId'>
export type NewMemoryInput = Omit<Memory, 'id' | 'createdAt'>
export type MemoryPatch = Omit<Memory, 'id' | 'createdAt'>

interface UserDataState {
  userDoc: UserDoc
  loading: boolean
  signedIn: boolean
  addBottle: (input: NewBottleInput) => Promise<void>
  addPour: (input: NewPourInput) => Promise<void>
  updatePour: (pourId: string, patch: PourPatch) => Promise<void>
  deletePour: (pourId: string) => Promise<void>
  addMemory: (input: NewMemoryInput) => Promise<void>
  updateMemory: (memoryId: string, patch: MemoryPatch) => Promise<void>
  deleteMemory: (memoryId: string) => Promise<void>
  addGalleryPhoto: (bottleId: string, photo: GalleryPhoto) => Promise<void>
  createInfinityBottle: (name: string) => Promise<void>
  addInfinityAddition: (infinityBottleId: string, addition: InfinityBottleAddition) => Promise<void>
}

const UserDataContext = createContext<UserDataState>({
  userDoc: EMPTY_USER_DOC,
  loading: true,
  signedIn: false,
  addBottle: async () => {},
  addPour: async () => {},
  updatePour: async () => {},
  deletePour: async () => {},
  addMemory: async () => {},
  updateMemory: async () => {},
  deleteMemory: async () => {},
  addGalleryPhoto: async () => {},
  createInfinityBottle: async () => {},
  addInfinityAddition: async () => {},
})

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const mockMode = isMockAuthEnabled()
  const [userDoc, setUserDoc] = useState<UserDoc>(EMPTY_USER_DOC)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setUserDoc(EMPTY_USER_DOC)
      setDataLoading(false)
      return
    }

    if (mockMode) {
      let cancelled = false
      import('../data/mockData').then(({ MOCK_USER_DOC }) => {
        if (cancelled) return
        setUserDoc(MOCK_USER_DOC)
        setDataLoading(false)
      })
      return () => {
        cancelled = true
      }
    }

    const cached = readCachedUserDoc(user.uid)
    if (cached) {
      setUserDoc(cached)
      setDataLoading(false)
    } else {
      setDataLoading(true)
    }

    let cancelled = false
    fetchUserDoc(user.uid).then((doc) => {
      if (cancelled) return
      setUserDoc(doc)
      setDataLoading(false)
      writeCachedUserDoc(user.uid, doc)
    })

    return () => {
      cancelled = true
    }
  }, [user, authLoading, mockMode])

  const addBottle = useCallback(
    async (input: NewBottleInput) => {
      if (!user) return
      const bottle: Bottle = { ...input, id: generateId(), createdAt: Date.now() }
      const nextBottles = [...userDoc.bottles, bottle]
      const nextDoc: UserDoc = { ...userDoc, bottles: nextBottles }
      setUserDoc(nextDoc)
      if (mockMode) return // dev fixture data — never touches Firestore
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { bottles: nextBottles })
    },
    [user, userDoc, mockMode],
  )

  const addPour = useCallback(
    async (input: NewPourInput) => {
      if (!user) return
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
      if (mockMode) return // dev fixture data — never touches Firestore
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { pours: nextPours, bottles: nextBottles })
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

  const deletePour = useCallback(
    async (pourId: string) => {
      if (!user) return
      const nextPours = userDoc.pours.filter((p) => p.id !== pourId)
      const nextDoc: UserDoc = { ...userDoc, pours: nextPours }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { pours: nextPours })
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
      const nextMemories = userDoc.memories.filter((m) => m.id !== memoryId)
      const nextDoc: UserDoc = { ...userDoc, memories: nextMemories }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { memories: nextMemories })
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

  const createInfinityBottle = useCallback(
    async (name: string) => {
      if (!user) return
      const infinityBottle = { id: generateId(), name, additions: [] }
      const nextInfinityBottles = [...userDoc.infinityBottles, infinityBottle]
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
    },
    [user, userDoc, mockMode],
  )

  const addInfinityAddition = useCallback(
    async (infinityBottleId: string, addition: InfinityBottleAddition) => {
      if (!user) return
      const nextInfinityBottles = userDoc.infinityBottles.map((ib) =>
        ib.id === infinityBottleId ? { ...ib, additions: [...ib.additions, addition] } : ib,
      )
      const nextDoc: UserDoc = { ...userDoc, infinityBottles: nextInfinityBottles }
      setUserDoc(nextDoc)
      if (mockMode) return
      writeCachedUserDoc(user.uid, nextDoc)
      await saveUserDoc(user.uid, { infinityBottles: nextInfinityBottles })
    },
    [user, userDoc, mockMode],
  )

  const value = useMemo<UserDataState>(
    () => ({
      userDoc,
      loading: authLoading || dataLoading,
      signedIn: Boolean(user),
      addBottle,
      addPour,
      updatePour,
      deletePour,
      addMemory,
      updateMemory,
      deleteMemory,
      addGalleryPhoto,
      createInfinityBottle,
      addInfinityAddition,
    }),
    [
      userDoc,
      authLoading,
      dataLoading,
      user,
      addBottle,
      addPour,
      updatePour,
      deletePour,
      addMemory,
      updateMemory,
      deleteMemory,
      addGalleryPhoto,
      createInfinityBottle,
      addInfinityAddition,
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
