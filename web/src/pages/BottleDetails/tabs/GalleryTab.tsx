import { useState } from 'react'
import type { Bottle } from '../../../data/types'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { PhotoUploadField } from '../../../features/photoUpload/PhotoUploadField'
import { useUserData } from '../../../hooks/useUserData'
import styles from './GalleryTab.module.css'

export function GalleryTab({ bottle }: { bottle: Bottle }) {
  const gallery = bottle.gallery ?? []
  const { addGalleryPhoto, deleteGalleryPhoto } = useUserData()
  const [confirmingUrl, setConfirmingUrl] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openConfirm(url: string) {
    setError(null)
    setConfirmingUrl(url)
  }

  function closeConfirm() {
    if (deleting) return
    setConfirmingUrl(null)
    setError(null)
  }

  async function handleDelete() {
    if (!confirmingUrl) return
    setDeleting(true)
    setError(null)
    try {
      await deleteGalleryPhoto(bottle.id, confirmingUrl)
      setConfirmingUrl(null)
    } catch {
      // The photo is still there — deleteGalleryPhoto only updates local
      // state once the Firestore write actually succeeds, so there's
      // nothing to roll back here, just a retryable error to show.
      setError('Could not delete that photo. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {gallery.length === 0 ? (
        <EmptyState title="No photos yet." message="Add a photo of this bottle." />
      ) : (
        <div className={styles.grid}>
          {gallery.map((photo, index) => (
            <figure className={styles.item} key={photo.url + index}>
              <div className={styles.imageWrap}>
                <img className={styles.image} src={photo.url} alt={photo.caption ?? ''} />
                <button type="button" className={styles.deleteButton} onClick={() => openConfirm(photo.url)} aria-label="Delete photo">
                  ×
                </button>
              </div>
              {photo.caption ? <figcaption className={styles.caption}>{photo.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      )}

      <PhotoUploadField
        label="Add a photo"
        folder="bottle-photos"
        onUploaded={(url, path) => addGalleryPhoto(bottle.id, { url, storagePath: path })}
      />

      {confirmingUrl ? (
        <Modal title="Delete this photo?" onClose={closeConfirm}>
          <p className={styles.confirmText}>This removes the photo from this bottle and cannot be undone.</p>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.confirmActions}>
            <Button variant="ghost" onClick={closeConfirm} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Photo'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
