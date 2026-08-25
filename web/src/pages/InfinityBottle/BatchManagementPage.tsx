import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InfinityBottleHeader } from '../../features/infinityBottle/InfinityBottleHeader'
import { batchDisplayName, batchVolumeMl, BLEND_GOAL_LABELS } from '../../features/infinityBottle/selectors'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { PhotoUploadField } from '../../features/photoUpload/PhotoUploadField'
import { deletePhotoIfSafe } from '../../features/photoUpload/uploadPhoto'
import { useUserData } from '../../hooks/useUserData'
import type { BlendGoal } from '../../data/types'
import styles from './BatchManagementPage.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const GOAL_OPTIONS: BlendGoal[] = ['sweeter', 'more-oak', 'more-spice', 'higher-proof', 'smoother', 'more-complexity', 'experimenting']

const EDIT_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 20h4L18 10l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
)
const ARCHIVE_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="4" y="6" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5 10v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)
const NEW_BATCH_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)
const DELETE_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

type Mode = 'none' | 'edit' | 'archive-confirm' | 'start-new' | 'delete-confirm'

export function BatchManagementPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userDoc, updateInfinityBottle, completeBatch, startNewBatch, deleteInfinityBottle } = useUserData()

  const ib = userDoc.infinityBottles.find((b) => b.id === id)
  const batch = ib?.batches[ib.batches.length - 1]

  const [mode, setMode] = useState<Mode>('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit form state
  const [editName, setEditName] = useState(ib?.name ?? '')
  const [editCapacity, setEditCapacity] = useState(ib?.capacityMl ? String(ib.capacityMl) : '')
  const [editPhotoUrl, setEditPhotoUrl] = useState(ib?.photoUrl)
  const [editPhotoPath, setEditPhotoPath] = useState(ib?.photoStoragePath)

  // Start New Batch form state
  const [carryForward, setCarryForward] = useState(false)
  const [carryAmount, setCarryAmount] = useState('')
  const [newBatchName, setNewBatchName] = useState('')
  const [newBatchGoal, setNewBatchGoal] = useState<BlendGoal | ''>('')

  if (!ib || !batch) {
    return (
      <div className={styles.page}>
        <InfinityBottleHeader backTo="/collection/infinity" title="Batch Management" />
        <div className={styles.body}>
          <EmptyState title="We couldn't find that Infinity Bottle." message="It may have been deleted." />
        </div>
      </div>
    )
  }

  function openEdit() {
    setEditName(ib!.name)
    setEditCapacity(ib!.capacityMl ? String(ib!.capacityMl) : '')
    setEditPhotoUrl(ib!.photoUrl)
    setEditPhotoPath(ib!.photoStoragePath)
    setError(null)
    setMode('edit')
  }

  async function handleSaveEdit() {
    if (!editName.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const oldPath = ib!.photoStoragePath
      await updateInfinityBottle(ib!.id, {
        name: editName.trim(),
        capacityMl: editCapacity ? Number(editCapacity) : undefined,
        photoUrl: editPhotoUrl,
        photoStoragePath: editPhotoPath,
      })
      if (oldPath && oldPath !== editPhotoPath) void deletePhotoIfSafe(oldPath)
      setMode('none')
    } catch {
      setError('Could not save those changes. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleArchiveBatch() {
    setBusy(true)
    setError(null)
    try {
      await completeBatch(ib!.id, batch!.id)
      setMode('none')
    } catch {
      setError('Could not archive this batch. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleStartNewBatch() {
    setBusy(true)
    setError(null)
    try {
      await startNewBatch(ib!.id, {
        name: newBatchName.trim() || undefined,
        goal: newBatchGoal || undefined,
        carryForwardMl: carryForward && carryAmount ? Number(carryAmount) : undefined,
      })
      navigate(`/collection/infinity/${ib!.id}`)
    } catch {
      setError('Could not start a new batch. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await deleteInfinityBottle(ib!.id)
      navigate('/collection/infinity')
    } catch {
      setError('Could not delete this Infinity Bottle. Try again.')
      setBusy(false)
    }
  }

  const currentVolume = batchVolumeMl(batch)

  return (
    <div className={styles.page}>
      <InfinityBottleHeader backTo={`/collection/infinity/${ib.id}`} title="Batch Management" />

      <div className={styles.body}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryPhotoWrap}>
            {ib.photoUrl ? <img className={styles.summaryPhoto} src={ib.photoUrl} alt="" /> : <div className={styles.summaryPhotoPlaceholder} />}
          </div>
          <div className={styles.summaryInfo}>
            <div className={styles.summaryName}>{batchDisplayName(ib, batch)}</div>
            <div className={batch.status === 'active' ? styles.statusActive : styles.statusComplete}>
              {batch.status === 'active' ? 'Current Batch' : 'Batch Complete'}
            </div>
            <div className={styles.summaryMetaRow}>
              <span>Created {dateFormatter.format(new Date(ib.createdAt))}</span>
              {ib.capacityMl ? <span>Capacity {ib.capacityMl}ml</span> : null}
            </div>
          </div>
        </div>

        <div className={styles.rows}>
          <button type="button" className={styles.rowButton} onClick={openEdit}>
            <span className={styles.icon}>{EDIT_ICON}</span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Edit Infinity Bottle</span>
              <span className={styles.rowDescription}>Name, photo, and capacity</span>
            </span>
          </button>

          {batch.status === 'active' ? (
            <button type="button" className={styles.rowButton} onClick={() => setMode('archive-confirm')}>
              <span className={styles.icon}>{ARCHIVE_ICON}</span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>Archive This Batch</span>
                <span className={styles.rowDescription}>Retire this batch without starting a new one</span>
              </span>
            </button>
          ) : null}

          <button type="button" className={styles.rowButton} onClick={() => setMode('start-new')}>
            <span className={styles.icon}>{NEW_BATCH_ICON}</span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Start New Batch</span>
              <span className={styles.rowDescription}>Create a new batch from scratch or carry some forward</span>
            </span>
          </button>
        </div>

        <button type="button" className={styles.deleteRow} onClick={() => setMode('delete-confirm')}>
          <span className={styles.icon}>{DELETE_ICON}</span>
          <span className={styles.rowTitle}>Delete Infinity Bottle</span>
        </button>
      </div>

      {mode === 'edit' ? (
        <Modal title="Edit Infinity Bottle" onClose={() => (busy ? null : setMode('none'))}>
          <Field label="Name" htmlFor="edit-ib-name" required>
            <input id="edit-ib-name" className={controlClassName} value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          <Field label="Capacity (ml, optional)" htmlFor="edit-ib-capacity">
            <input
              id="edit-ib-capacity"
              type="number"
              inputMode="numeric"
              className={controlClassName}
              value={editCapacity}
              onChange={(e) => setEditCapacity(e.target.value)}
            />
          </Field>
          <PhotoUploadField
            label="Cover Photo (optional)"
            folder="infinity-bottle-photos"
            currentUrl={editPhotoUrl}
            onUploaded={(url, path) => {
              setEditPhotoUrl(url)
              setEditPhotoPath(path)
            }}
          />
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setMode('none')} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={!editName.trim() || busy}>
              {busy ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {mode === 'archive-confirm' ? (
        <Modal title="Archive this batch?" onClose={() => (busy ? null : setMode('none'))}>
          <p className={styles.confirmText}>
            This marks the current batch complete without starting a new one. Its blend, tastings, and timeline stay exactly as they
            are.
          </p>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setMode('none')} disabled={busy}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => void handleArchiveBatch()} disabled={busy}>
              {busy ? 'Archiving…' : 'Archive This Batch'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {mode === 'start-new' ? (
        <Modal title="Start New Batch" onClose={() => (busy ? null : setMode('none'))}>
          <div className={styles.startChoices}>
            <button type="button" className={!carryForward ? `${styles.choice} ${styles.choiceActive}` : styles.choice} onClick={() => setCarryForward(false)}>
              Start Empty
            </button>
            <button type="button" className={carryForward ? `${styles.choice} ${styles.choiceActive}` : styles.choice} onClick={() => setCarryForward(true)}>
              Carry Forward Some
            </button>
          </div>
          {carryForward ? (
            <Field label={`Amount to carry forward (ml, up to ${currentVolume}ml)`} htmlFor="carry-amount">
              <input
                id="carry-amount"
                type="number"
                inputMode="numeric"
                className={controlClassName}
                value={carryAmount}
                onChange={(e) => setCarryAmount(e.target.value)}
                max={currentVolume}
              />
            </Field>
          ) : null}
          <Field label="New batch name (optional)" htmlFor="new-batch-name">
            <input id="new-batch-name" className={controlClassName} value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} placeholder="Second Alarm" />
          </Field>
          <Field label="Blend goal (optional)" htmlFor="new-batch-goal">
            <select id="new-batch-goal" className={controlClassName} value={newBatchGoal} onChange={(e) => setNewBatchGoal(e.target.value as BlendGoal | '')}>
              <option value="">None</option>
              {GOAL_OPTIONS.map((goal) => (
                <option key={goal} value={goal}>
                  {BLEND_GOAL_LABELS[goal]}
                </option>
              ))}
            </select>
          </Field>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setMode('none')} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleStartNewBatch()}
              disabled={busy || (carryForward && (!carryAmount || Number(carryAmount) <= 0 || Number(carryAmount) > currentVolume))}
            >
              {busy ? 'Starting…' : 'Start New Batch'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {mode === 'delete-confirm' ? (
        <Modal title="Delete this Infinity Bottle?" onClose={() => (busy ? null : setMode('none'))}>
          <p className={styles.confirmText}>
            This removes the blend, every batch, tasting, and photo, and cannot be undone. Your source bottles in My Bar are not
            affected.
          </p>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setMode('none')} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete Infinity Bottle'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
