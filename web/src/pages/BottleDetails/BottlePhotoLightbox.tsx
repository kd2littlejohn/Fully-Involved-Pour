import { useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { standardizeAndUploadBottlePhoto } from '../../features/photoUpload/standardizeAndUploadBottlePhoto'
import type { Bottle } from '../../data/types'
import styles from './BottlePhotoLightbox.module.css'

interface BottlePhotoLightboxProps {
  bottle: Bottle
  onClose: () => void
}

export function BottlePhotoLightbox({ bottle, onClose }: BottlePhotoLightboxProps) {
  const { user } = useAuth()
  const { updateBottle } = useUserData()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showingOriginal, setShowingOriginal] = useState(false)

  const hasOriginal = Boolean(bottle.originalImageUrl && bottle.originalImageUrl !== bottle.imageUrl)
  const displayedUrl = showingOriginal && bottle.originalImageUrl ? bottle.originalImageUrl : bottle.imageUrl

  async function handleReplace(file: File) {
    setError(null)
    setUploading(true)
    setShowingOriginal(false)
    try {
      const result = await standardizeAndUploadBottlePhoto(user?.uid, file)
      await updateBottle(bottle.id, {
        imageUrl: result.imageUrl,
        originalImageUrl: result.originalImageUrl,
        imageProcessingStatus: result.imageProcessingStatus,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void handleReplace(file)
  }

  return (
    <Modal title={bottle.name} onClose={onClose}>
      <div className={styles.frame}>
        {displayedUrl ? <img className={styles.image} src={displayedUrl} alt="" /> : <BottlePlaceholder name={bottle.name} />}
        {uploading ? (
          <div className={styles.overlay}>
            <span className={styles.overlayText}>Uploading…</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {hasOriginal ? (
        <button type="button" className={styles.originalToggle} onClick={() => setShowingOriginal((v) => !v)} disabled={uploading}>
          {showingOriginal ? 'View Standardized Photo' : 'View Original Photo'}
        </button>
      ) : null}

      <label className={styles.replaceAction}>
        {bottle.imageUrl ? 'Replace Photo' : 'Add Photo'}
        <input type="file" accept="image/*" className={styles.hiddenInput} onChange={handleChange} disabled={uploading} />
      </label>
    </Modal>
  )
}
