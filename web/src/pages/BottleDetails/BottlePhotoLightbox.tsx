import { useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { uploadPhoto } from '../../features/photoUpload/uploadPhoto'
import { cutoutBottlePhoto } from '../../features/photoUpload/cutoutBottlePhoto'
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

  async function handleReplace(file: File) {
    setError(null)
    setUploading(true)
    try {
      const cutout = await cutoutBottlePhoto(file)
      const url = await uploadPhoto(user?.uid, cutout, 'bottle-photos')
      await updateBottle(bottle.id, { imageUrl: url })
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
        {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder name={bottle.name} />}
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

      <label className={styles.replaceAction}>
        {bottle.imageUrl ? 'Replace Photo' : 'Add Photo'}
        <input type="file" accept="image/*" className={styles.hiddenInput} onChange={handleChange} disabled={uploading} />
      </label>
    </Modal>
  )
}
