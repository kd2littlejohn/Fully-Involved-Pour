import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { fipTier } from '../fip/tiers'
import { TastingForm, tastingValueToInput, type TastingFormValue } from './TastingForm'
import { useUserData } from '../../hooks/useUserData'
import type { InfinityTasting } from '../../data/types'
import styles from './TastingDetailModal.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function toFormValue(t: InfinityTasting): TastingFormValue {
  return {
    date: t.date,
    score: t.score,
    noseAromas: t.noseAromas,
    noseNotes: t.noseNotes ?? '',
    palateFlavors: t.palateFlavors,
    palateNotes: t.palateNotes ?? '',
    finishNotes: t.finishNotes ?? '',
    overallNotes: t.overallNotes ?? '',
    companion: t.companion ?? '',
    photoUrl: t.photoUrl,
    photoStoragePath: t.photoStoragePath,
  }
}

interface TastingDetailModalProps {
  infinityBottleId: string
  batchId: string
  tasting: InfinityTasting
  onClose: () => void
}

export function TastingDetailModal({ infinityBottleId, batchId, tasting, onClose }: TastingDetailModalProps) {
  const { updateTasting, deleteTasting } = useUserData()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<TastingFormValue>(() => toFormValue(tasting))
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await updateTasting(infinityBottleId, batchId, tasting.id, tastingValueToInput(value))
      onClose()
    } catch {
      setError('Could not save that tasting. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteTasting(infinityBottleId, batchId, tasting.id)
      onClose()
    } catch {
      setError('Could not delete that tasting. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <Modal title="Edit Tasting" onClose={onClose}>
        <TastingForm
          value={value}
          onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
          onSubmit={() => void handleSave()}
          submitLabel="Save Changes"
          submitting={saving}
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </Modal>
    )
  }

  const tier = fipTier(tasting.score)

  return (
    <Modal title={dateFormatter.format(new Date(tasting.date))} onClose={onClose}>
      <div className={styles.scoreRow}>
        <span className={styles.score} style={{ color: tier.color }}>
          {tasting.score.toFixed(1)}
        </span>
        <span className={styles.tier} style={{ color: tier.color }}>
          {tier.label}
        </span>
      </div>

      {tasting.photoUrl ? <img className={styles.photo} src={tasting.photoUrl} alt="" /> : null}

      {tasting.noseAromas.length > 0 || tasting.noseNotes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Nose</h3>
          {tasting.noseAromas.length > 0 ? <p className={styles.notes}>{tasting.noseAromas.join(', ')}</p> : null}
          {tasting.noseNotes ? <p className={styles.notes}>{tasting.noseNotes}</p> : null}
        </div>
      ) : null}

      {tasting.palateFlavors.length > 0 || tasting.palateNotes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Palate</h3>
          {tasting.palateFlavors.length > 0 ? <p className={styles.notes}>{tasting.palateFlavors.join(', ')}</p> : null}
          {tasting.palateNotes ? <p className={styles.notes}>{tasting.palateNotes}</p> : null}
        </div>
      ) : null}

      {tasting.finishNotes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Finish</h3>
          <p className={styles.notes}>{tasting.finishNotes}</p>
        </div>
      ) : null}

      {tasting.overallNotes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Overall Notes</h3>
          <p className={styles.notes}>{tasting.overallNotes}</p>
        </div>
      ) : null}

      {tasting.companion ? <p className={styles.companion}>With {tasting.companion}</p> : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        {confirmingDelete ? (
          <div className={styles.confirm}>
            <span className={styles.confirmText}>Delete this tasting? This cannot be undone.</span>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Tasting'}
            </Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
