import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../data/firebase'

export function useSignIn() {
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setSigningIn(true)
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch {
      setError('Sign-in was cancelled or failed. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }

  return { signIn, signingIn, error }
}
