import { Button } from '../ui/Button'
import { useSignIn } from '../../hooks/useSignIn'
import styles from './SignInButton.module.css'

export function SignInButton() {
  const { signIn, signingIn, error } = useSignIn()

  return (
    <div>
      <Button onClick={signIn} disabled={signingIn}>
        {signingIn ? 'Signing in…' : 'Sign in with Google'}
      </Button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
