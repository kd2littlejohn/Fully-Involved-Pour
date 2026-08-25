import { useState } from 'react'
import type { Bottle } from '../../../data/types'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Button } from '../../../components/ui/Button'
import { PhotoUploadField } from '../../../features/photoUpload/PhotoUploadField'
import { useUserData } from '../../../hooks/useUserData'
import styles from './GalleryTab.module.css'

export function GalleryTab({ bottle }: { bottle: Bottle }) {
  const gallery = bottle.gallery ?? []
  const { addGalleryPhoto, deleteGalleryPhoto } = useUserData()
  const [confirmingUrl, setConfirmingUrl] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(url: string) {
    setDeleting(true)
    await deleteGalleryPhoto(bottle.id, url)
    setDeleting(false)
    setConfirmingUrl(null)
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
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => setConfirmingUrl(photo.url)}
                  aria-label="Delete photo"
                >
                  ×
                </button>
                {confirmingUrl === photo.url ? (
                  <div className={styles.confirmOverlay}>
                    <p className={styles.confirmText}>Delete this photo? This cannot be undone.</p>
                    <div className={styles.confirmActions}>
                      <Button variant="ghost" onClick={() => setConfirmingUrl(null)} disabled={deleting}>
                        Cancel
                      </Button>
                      <Button variant="danger" onClick={() => void handleDelete(photo.url)} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete Photo'}
                      </Button>
                    </div>
                  </div>
                ) : null}
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
    </>
  )
}
