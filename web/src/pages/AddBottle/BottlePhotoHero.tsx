import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { useAuth } from '../../hooks/useAuth'
import { downscaleImageToJpegBase64 } from '../../features/ai/imageToBase64'
import { scanBottleLabel, type LabelScanResult } from '../../data/repositories/ai'
import { standardizeAndUploadBottlePhoto } from '../../features/photoUpload/standardizeAndUploadBottlePhoto'
import type { ImageProcessingStatus } from '../../data/types'
import styles from './BottlePhotoHero.module.css'

export interface BottlePhotoChange {
  imageUrl: string | undefined
  originalImageUrl?: string
  imageStoragePath?: string
  originalImageStoragePath?: string
  imageProcessingStatus?: ImageProcessingStatus
}

interface BottlePhotoHeroProps {
  imageUrl?: string
  name?: string
  onImageChange: (change: BottlePhotoChange) => void
  onScanResult: (info: LabelScanResult) => void
}

type Mode = 'scan' | 'camera' | 'library'

export function BottlePhotoHero({ imageUrl, name, onImageChange, onScanResult }: BottlePhotoHeroProps) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const lastFileRef = useRef<File | null>(null)
  const lastModeRef = useRef<Mode>('library')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  async function handleFile(file: File, mode: Mode) {
    lastFileRef.current = file
    lastModeRef.current = mode
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const localUrl = URL.createObjectURL(file)
    objectUrlRef.current = localUrl
    onImageChange({ imageUrl: localUrl })

    setError(null)
    setUploading(true)
    setProgress(0)
    if (mode === 'scan') setScanning(true)

    try {
      const uploadPromise = standardizeAndUploadBottlePhoto(user?.uid, file, setProgress).then((result) => {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
        onImageChange(result)
        return result.imageUrl
      })

      if (mode === 'scan') {
        const base64 = await downscaleImageToJpegBase64(file)
        const [info] = await Promise.all([scanBottleLabel(base64, 'image/jpeg'), uploadPromise])
        if (!info.found) {
          setError("Couldn't read a bottle label in that photo — fill in the details manually below.")
        } else {
          onScanResult(info)
        }
      } else {
        await uploadPromise
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed. Please try again.')
    } finally {
      setUploading(false)
      setScanning(false)
    }
  }

  async function handleScanCurrentPhoto() {
    const file = lastFileRef.current
    if (!file || busy) return
    setError(null)
    setScanning(true)
    try {
      const base64 = await downscaleImageToJpegBase64(file)
      const info = await scanBottleLabel(base64, 'image/jpeg')
      if (!info.found) {
        setError("Couldn't read a bottle label in that photo — fill in the details manually below.")
      } else {
        onScanResult(info)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  function handleRetry() {
    const file = lastFileRef.current
    if (!file || busy) return
    void handleFile(file, lastModeRef.current)
  }

  function handleChange(mode: Mode) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void handleFile(file, mode)
    }
  }

  function handleRemove() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setError(null)
    onImageChange({ imageUrl: undefined })
  }

  const busy = uploading || scanning

  return (
    <div className={styles.hero}>
      <div className={styles.frame}>
        {imageUrl ? <img className={styles.image} src={imageUrl} alt="" /> : <BottlePlaceholder name={name} />}
        {busy ? (
          <div className={styles.overlay}>
            <span className={styles.overlayText}>{scanning ? 'Reading label…' : `Uploading… ${Math.round(progress * 100)}%`}</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className={styles.errorRow}>
          <p className={styles.error} role="alert">
            {error}
          </p>
          {lastFileRef.current ? (
            <button type="button" className={styles.secondaryAction} onClick={handleRetry} disabled={busy}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        {imageUrl && lastFileRef.current ? (
          <button type="button" className={styles.primaryAction} onClick={() => void handleScanCurrentPhoto()} disabled={busy}>
            ✨ Scan This Photo for Details
          </button>
        ) : (
          <label className={styles.primaryAction}>
            ✨ Scan Label with AI
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              onChange={handleChange('scan')}
              disabled={busy}
            />
          </label>
        )}

        <div className={styles.secondaryRow}>
          <label className={styles.secondaryAction}>
            Take Photo
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className={styles.hiddenInput}
              onChange={handleChange('camera')}
              disabled={busy}
            />
          </label>
          <label className={styles.secondaryAction}>
            Choose Photo
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              onChange={handleChange('library')}
              disabled={busy}
            />
          </label>
          {imageUrl ? (
            <button type="button" className={styles.secondaryAction} onClick={handleRemove} disabled={busy}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
