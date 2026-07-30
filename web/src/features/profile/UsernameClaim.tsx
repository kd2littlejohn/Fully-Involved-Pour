import { useState } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import { UsernameTakenError } from '../../data/repositories/username'
import styles from './UsernameClaim.module.css'

export function UsernameClaim({ current }: { current?: string }) {
  const { claimUsername } = useUserData()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (current) {
    return (
      <div className={styles.wrap}>
        <span className={styles.handle}>@{current}</span>
      </div>
    )
  }

  async function handleClaim() {
    if (!value.trim()) return
    setSaving(true)
    setError(null)
    try {
      await claimUsername(value.trim())
    } catch (err) {
      setError(err instanceof UsernameTakenError ? err.message : 'Could not claim that username. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <Field label="Claim a username" htmlFor="claim-username">
        <input
          id="claim-username"
          className={controlClassName}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="whiskeywanderer"
        />
      </Field>
      <Button onClick={handleClaim} disabled={saving || !value.trim()}>
        {saving ? 'Claiming…' : 'Claim'}
      </Button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
