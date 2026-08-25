import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import { useAuth } from '../../hooks/useAuth'
import { uploadPhoto } from './uploadPhoto'
import { cutoutBottlePhoto } from './cutoutBottlePhoto'
import styles from './PhotoUploadField.module.css'

interface PhotoUploadFieldProps {
  label: string
  folder: 'bottle-photos' | 'memory-photos' | 'pour-photos' | 'infinity-bottle-photos'
  currentUrl?: string
  // path is the Storage object path behind url — passed through so callers
  // can track it for later cleanup (delete/replace); optional because a
  // caller that doesn't need cleanup can ignore the second argument.
  onUploaded: (url: string, path?: string) => void
}

export function PhotoUploadField({ label, folder, currentUrl, onUploaded }: PhotoUploadFieldProps) {
  const { user } = useAuth()
  const inputId = useId()
  const [preview, setPreview] = useState(currentUrl)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    // Instant local preview while the real upload runs in the background.
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const localUrl = URL.createObjectURL(file)
    objectUrlRef.current = localUrl
    setPreview(localUrl)

    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      // Bottle photos get a clean server-side background cutout; personal
      // memory snapshots stay as-is.
      const fileToUpload = folder === 'bottle-photos' ? await cutoutBottlePhoto(file) : file
      const { url, path } = await uploadPhoto(user?.uid, fileToUpload, folder, setProgress)
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      setPreview(url)
      onUploaded(url, path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Field label={label} htmlFor={inputId}>
      {preview ? (
        <div className={styles.previewWrap}>
          <img className={styles.preview} src={preview} alt="" />
          {uploading ? (
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className={controlClassName}
        onChange={handleChange}
        disabled={uploading}
      />
      {uploading ? <p className={styles.status}>Uploading… {Math.round(progress * 100)}%</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Field>
  )
}
