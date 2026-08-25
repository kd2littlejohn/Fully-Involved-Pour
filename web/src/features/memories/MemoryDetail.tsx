import { useRef, useState, type ChangeEvent } from 'react'
import type { Memory } from '../../data/types'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { uploadPhoto, deletePhotoIfSafe } from '../photoUpload/uploadPhoto'
import { MemoryForm } from './MemoryForm'
import styles from './MemoryDetail.module.css'

interface MemoryDetailProps {
  memory: Memory
  bottleName?: string
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export function MemoryDetail({ memory, bottleName, onClose }: MemoryDetailProps) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingPhotoDelete, setConfirmingPhotoDelete] = useState(false)
  const [deletingPhoto, setDeletingPhoto] = useState(false)
  const [replacingPhoto, setReplacingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const { userDoc, updateMemory, deleteMemory } = useUserData()

  async function handleDelete() {
    setDeleting(true)
    await deleteMemory(memory.id)
    setDeleting(false)
    onClose()
  }

  // MemoryPatch requires the whole Memory shape (minus id/createdAt), not a
  // partial — same "strip id, spread the rest" pattern PourStoryCard's
  // toggleFeatured uses for the same reason.
  function patchFrom(overrides: Partial<Memory>) {
    const { id: _id, createdAt: _createdAt, ...rest } = memory
    return { ...rest, ...overrides }
  }

  async function handleDeletePhoto() {
    setDeletingPhoto(true)
    setPhotoError(null)
    try {
      const oldPath = memory.photoStoragePath
      await updateMemory(memory.id, patchFrom({ photoUrl: undefined, photoStoragePath: undefined }))
      if (oldPath) void deletePhotoIfSafe(oldPath)
      setConfirmingPhotoDelete(false)
    } catch {
      setPhotoError('Could not delete that photo. Try again.')
    } finally {
      setDeletingPhoto(false)
    }
  }

  async function handleReplacePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setReplacingPhoto(true)
    setPhotoError(null)
    try {
      const oldPath = memory.photoStoragePath
      const { url, path } = await uploadPhoto(user?.uid, file, 'memory-photos')
      await updateMemory(memory.id, patchFrom({ photoUrl: url, photoStoragePath: path }))
      if (oldPath && oldPath !== path) void deletePhotoIfSafe(oldPath)
    } catch {
      setPhotoError('Could not upload that photo. Try again.')
    } finally {
      setReplacingPhoto(false)
    }
  }

  const photoMenuItems: OverflowMenuItem[] = [
    { label: 'Replace Photo', onClick: () => replaceInputRef.current?.click(), disabled: replacingPhoto || deletingPhoto },
    { label: 'Delete Photo', tone: 'danger', onClick: () => setConfirmingPhotoDelete(true), disabled: replacingPhoto || deletingPhoto },
  ]

  if (editing) {
    return (
      <Modal title="Edit Memory" onClose={onClose}>
        <MemoryForm
          bottles={userDoc.bottles}
          initial={memory}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            await updateMemory(memory.id, input)
            onClose()
          }}
        />
      </Modal>
    )
  }

  const metaParts = [dateFormatter.format(new Date(memory.date)), memory.occasion, memory.location, bottleName].filter(Boolean)

  return (
    <Modal title={memory.title} onClose={onClose}>
      {memory.photoUrl ? (
        <div className={styles.photoWrap}>
          <img className={styles.photo} src={memory.photoUrl} alt="" />
          <div className={styles.photoMenu}>
            <OverflowMenu items={photoMenuItems} label="Photo actions" />
          </div>
          {replacingPhoto ? <div className={styles.photoOverlay}>Uploading…</div> : null}
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={(e) => void handleReplacePhoto(e)}
          />
        </div>
      ) : null}

      {photoError ? (
        <p className={styles.error} role="alert">
          {photoError}
        </p>
      ) : null}

      {confirmingPhotoDelete ? (
        <div className={styles.confirm}>
          <span className={styles.confirmText}>
            Delete this photo? This removes the photo from this memory and cannot be undone.
          </span>
          <Button variant="ghost" onClick={() => setConfirmingPhotoDelete(false)} disabled={deletingPhoto}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDeletePhoto()} disabled={deletingPhoto}>
            {deletingPhoto ? 'Deleting…' : 'Delete Photo'}
          </Button>
        </div>
      ) : null}

      <div className={styles.meta}>
        {metaParts.join(' · ')}
        {memory.people.length > 0 ? <div>With {memory.people.join(', ')}</div> : null}
      </div>

      <p className={styles.story}>{memory.story}</p>

      <div className={styles.actions}>
        {confirmingDelete ? (
          <div className={styles.confirm}>
            <span className={styles.confirmText}>
              Delete this memory?
              {memory.photoUrl ? ' This also removes its photo and cannot be undone.' : ' This cannot be undone.'}
            </span>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Confirm Delete'}
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
