import { useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { standardizeAndUploadBottlePhoto } from '../../features/photoUpload/standardizeAndUploadBottlePhoto'
import { bottlePhotoUrl } from '../../features/photoUpload/bottlePhotoUrl'
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
  const [showingStandardized, setShowingStandardized] = useState(false)

  // Defaults to the untouched original (the photo's own shape, no baked-in
  // backdrop); the FIP-standardized version stays one tap away.
  const hasStandardized = Boolean(bottle.originalImageUrl && bottle.imageUrl && bottle.originalImageUrl !== bottle.imageUrl)
  const displayedUrl = showingStandardized && bottle.imageUrl ? bottle.imageUrl : bottlePhotoUrl(bottle)

  async function handleReplace(file: File) {
    setError(null)
    setUploading(true)
    setShowingStandardized(false)
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
        {displayedUrl ? (
          <img className={styles.image} src={displayedUrl} alt="" />
        ) : (
          <div className={styles.placeholderFrame}>
            <BottlePlaceholder name={bottle.name} />
          </div>
        )}
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

      {hasStandardized ? (
        <button type="button" className={styles.originalToggle} onClick={() => setShowingStandardized((v) => !v)} disabled={uploading}>
          {showingStandardized ? 'View Original Photo' : 'View Standardized Photo'}
        </button>
      ) : null}

      <label className={styles.replaceAction}>
        {bottle.imageUrl ? 'Replace Photo' : 'Add Photo'}
        <input type="file" accept="image/*" className={styles.hiddenInput} onChange={handleChange} disabled={uploading} />
      </label>
    </Modal>
  )
}
