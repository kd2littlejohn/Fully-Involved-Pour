import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../data/firebase'
import { isMockAuthEnabled } from '../data/devMode'

interface AuthState {
  user: User | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    if (isMockAuthEnabled()) {
      let cancelled = false
      import('../data/mockAuth').then(({ MOCK_USER }) => {
        if (!cancelled) setState({ user: MOCK_USER, loading: false })
      })
      return () => {
        cancelled = true
      }
    }

    return onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false })
    })
  }, [])

  return state
}
