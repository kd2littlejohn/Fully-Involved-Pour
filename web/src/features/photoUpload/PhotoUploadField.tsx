import { useId, useState, type ChangeEvent } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import { useAuth } from '../../hooks/useAuth'
import { uploadPhoto, PhotoTooLargeError } from './uploadPhoto'
import { cutoutBottlePhoto } from './cutoutBottlePhoto'
import styles from './PhotoUploadField.module.css'

interface PhotoUploadFieldProps {
  label: string
  folder: 'bottle-photos' | 'memory-photos'
  currentUrl?: string
  onUploaded: (url: string) => void
}

export function PhotoUploadField({ label, folder, currentUrl, onUploaded }: PhotoUploadFieldProps) {
  const { user } = useAuth()
  const inputId = useId()
  const [preview, setPreview] = useState(currentUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    setError(null)
    try {
      // Bottle photos get a clean server-side background cutout; personal
      // memory snapshots stay as-is.
      const fileToUpload = folder === 'bottle-photos' ? await cutoutBottlePhoto(file) : file
      const url = await uploadPhoto(user.uid, fileToUpload, folder)
      setPreview(url)
      onUploaded(url)
    } catch (err) {
      setError(err instanceof PhotoTooLargeError ? err.message : 'Photo upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Field label={label} htmlFor={inputId}>
      {preview ? <img className={styles.preview} src={preview} alt="" /> : null}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className={controlClassName}
        onChange={handleChange}
        disabled={uploading}
      />
      {uploading ? <p className={styles.status}>Uploading…</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Field>
  )
}
