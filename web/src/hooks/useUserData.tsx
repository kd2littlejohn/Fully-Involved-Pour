import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { EMPTY_USER_DOC, fetchUserDoc } from '../data/repositories/userDoc'
import { readCachedUserDoc, writeCachedUserDoc } from '../data/localCache'
import type { UserDoc } from '../data/types'

interface UserDataState {
  userDoc: UserDoc
  loading: boolean
  signedIn: boolean
}

const UserDataContext = createContext<UserDataState>({
  userDoc: EMPTY_USER_DOC,
  loading: true,
  signedIn: false,
})

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [userDoc, setUserDoc] = useState<UserDoc>(EMPTY_USER_DOC)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setUserDoc(EMPTY_USER_DOC)
      setDataLoading(false)
      return
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
  }, [user, authLoading])

  const value = useMemo<UserDataState>(
    () => ({ userDoc, loading: authLoading || dataLoading, signedIn: Boolean(user) }),
    [userDoc, authLoading, dataLoading, user],
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
