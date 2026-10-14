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

    // An anonymous identity is a Blind Room Party guest (see
    // features/party/useGuestIdentity.ts), not an FIP account — the rest of
    // the app treats it exactly like being signed out, so a guest never
    // gets a users/{uid} document, a profile, or an empty My Bar.
    return onAuthStateChanged(auth, (user) => {
      setState({ user: user && !user.isAnonymous ? user : null, loading: false })
    })
  }, [])

  return state
}
