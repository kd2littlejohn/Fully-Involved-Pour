import { useState } from 'react'
import { GoogleAuthProvider, linkWithPopup, signInWithCredential, type AuthError } from 'firebase/auth'
import { auth, googleProvider } from '../../data/firebase'
import { Button } from '../../components/ui/Button'
import { LinkButton } from '../../components/ui/LinkButton'
import { claimGuest, createClaimToken, partyErrorMessage } from '../../data/repositories/party'
import styles from './party.module.css'

// Optional, after the fun: guests can keep their tasting history by
// creating an FIP account. Never required to join, score or see results.
//
// Linking upgrades the anonymous guest identity in place — same uid, so
// every ballot stays theirs with nothing to move. If that Google account
// already exists, the anonymous session first mints a single-use claim
// token (only it can), then the signed-in account redeems it; the server
// moves only that guest's records (functions/party/service.js claimGuest).
export function KeepYourResults() {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function keep() {
    const current = auth.currentUser
    if (!current) return
    setStatus('working')
    setError(null)
    try {
      await linkWithPopup(current, googleProvider)
      setStatus('done')
    } catch (err) {
      const code = (err as AuthError).code
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        try {
          const credential = GoogleAuthProvider.credentialFromError(err as AuthError)
          if (!credential) throw err
          const { token } = await createClaimToken()
          await signInWithCredential(auth, credential)
          await claimGuest(token)
          setStatus('done')
          return
        } catch (claimErr) {
          setError(partyErrorMessage(claimErr))
          setStatus('error')
          return
        }
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setStatus('idle')
        return
      }
      setError('Sign-in didn’t finish. Your scores are safe — try again anytime.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <section className={`${styles.card} ${styles.cardWarm}`} aria-live="polite">
        <span className={styles.eyebrow}>Welcome to Fully Involved Pour</span>
        <p className={styles.subtitle}>This party is saved to your account. Discover More. Savor More. Share More.</p>
        <LinkButton to="/">Explore FIP</LinkButton>
      </section>
    )
  }

  return (
    <section className={`${styles.card} ${styles.cardWarm}`} aria-labelledby="keep-heading">
      <span className={styles.eyebrow}>Optional</span>
      <h2 id="keep-heading" className={styles.sectionTitle}>
        Enjoyed the experience?
      </h2>
      <p className={styles.subtitle}>Continue your whiskey journey with Fully Involved Pour, and keep tonight’s tasting in your history.</p>
      <Button onClick={keep} disabled={status === 'working'}>
        {status === 'working' ? 'Connecting…' : 'Keep my results with Google'}
      </Button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
