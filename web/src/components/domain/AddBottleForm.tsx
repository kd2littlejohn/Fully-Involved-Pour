import { useState, type FormEvent } from 'react'
import type { BottleStatus } from '../../data/types'
import { Field, controlClassName } from '../ui/Field'
import { Button } from '../ui/Button'
import styles from './AddBottleForm.module.css'

interface AddBottleFormProps {
  onSubmit: (input: { name: string; distillery?: string; type?: string; status: BottleStatus; proof?: number }) => Promise<void>
  onCancel: () => void
  defaultStatus?: BottleStatus
}

const STATUS_OPTIONS: { value: BottleStatus; label: string }[] = [
  { value: 'sealed', label: 'Sealed' },
  { value: 'open', label: 'Opened' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'finished', label: 'Finished' },
]

export function AddBottleForm({ onSubmit, onCancel, defaultStatus = 'sealed' }: AddBottleFormProps) {
  const [name, setName] = useState('')
  const [distillery, setDistillery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState<BottleStatus>(defaultStatus)
  const [proof, setProof] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Bottle name is required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        distillery: distillery.trim() || undefined,
        type: type.trim() || undefined,
        status,
        proof: proof ? Number(proof) : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Field label="Bottle name" htmlFor="bottle-name">
        <input
          id="bottle-name"
          className={controlClassName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Eagle Rare 10 Year"
          required
        />
      </Field>

      <Field label="Distillery" htmlFor="bottle-distillery">
        <input
          id="bottle-distillery"
          className={controlClassName}
          value={distillery}
          onChange={(e) => setDistillery(e.target.value)}
          placeholder="Buffalo Trace"
        />
      </Field>

      <Field label="Type" htmlFor="bottle-type">
        <input
          id="bottle-type"
          className={controlClassName}
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Bourbon"
        />
      </Field>

      <Field label="Status" htmlFor="bottle-status">
        <select
          id="bottle-status"
          className={controlClassName}
          value={status}
          onChange={(e) => setStatus(e.target.value as BottleStatus)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Proof (optional)" htmlFor="bottle-proof">
        <input
          id="bottle-proof"
          className={controlClassName}
          type="number"
          inputMode="decimal"
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          placeholder="90"
        />
      </Field>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add Bottle'}
        </Button>
      </div>
    </form>
  )
}
