import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { auth } from '../../data/firebase'

interface GuestIdentity {
  // Any Firebase identity: a signed-in FIP account, or an anonymous party
  // guest. (useAuth() deliberately hides anonymous identities from the rest
  // of the app; Party Mode is the one place that uses them.)
  user: User | null
  loading: boolean
  ensureIdentity: () => Promise<User>
}

// Guests join without an FIP account. The first time they need an identity
// (joining, opening a display), this signs them in anonymously; Firebase
// keeps that session in the browser across refreshes, so a guest who
// reloads or comes back later is the same participant with the same
// ballots. A signed-in FIP user just uses their own account.
export function useGuestIdentity(): GuestIdentity {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next)
        setLoading(false)
      }),
    [],
  )

  const ensureIdentity = useCallback(async () => {
    if (auth.currentUser) return auth.currentUser
    const credential = await signInAnonymously(auth)
    return credential.user
  }, [])

  return { user, loading, ensureIdentity }
}
