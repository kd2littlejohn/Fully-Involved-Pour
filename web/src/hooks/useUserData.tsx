import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { EMPTY_USER_DOC, fetchUserDoc, saveUserDoc } from '../data/repositories/userDoc'
import { readCachedUserDoc, writeCachedUserDoc } from '../data/localCache'
import { isMockAuthEnabled } from '../data/devMode'
import type { Bottle, UserDoc } from '../data/types'

export type NewBottleInput = Omit<Bottle, 'id' | 'createdAt'>

interface UserDataState {
  userDoc: UserDoc
  loading: boolean
  signedIn: boolean
  addBottle: (input: NewBottleInput) => Promise<void>
}

const UserDataContext = createContext<UserDataState>({
  userDoc: EMPTY_USER_DOC,
  loading: true,
  signedIn: false,
  addBottle: async () => {},
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

  const value = useMemo<UserDataState>(
    () => ({ userDoc, loading: authLoading || dataLoading, signedIn: Boolean(user), addBottle }),
    [userDoc, authLoading, dataLoading, user, addBottle],
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
