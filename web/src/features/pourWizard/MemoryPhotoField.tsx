import { useEffect, useState } from 'react'
import { PhotoActionSheet } from './PhotoActionSheet'
import type { MemoryPhotoState } from './steps/StepProps'
import styles from './MemoryPhotoField.module.css'

// The pour's own optional "moment" photo — distinct from the bottle photo,
// a Poured With person's avatar, and Quick Pour's simpler photoUrl. Reuses
// PhotoActionSheet (same Take/Choose/Remove pattern as person avatars) so
// there's exactly one photo-picking UI in the wizard, not two. Never
// required, never circular, never cropped tight like an avatar.
export function MemoryPhotoField({ existingUrl, pendingFile, removed, onPick, onRemove }: MemoryPhotoState) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl(undefined)
      return
    }
    const url = URL.createObjectURL(pendingFile)
    setPendingPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingFile])

  const previewUrl = pendingPreviewUrl ?? (!removed ? existingUrl : undefined)

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>Capture the Moment</h3>
      <p className={styles.caption}>Add a photo from this pour.</p>

      {previewUrl ? (
        <button type="button" className={styles.previewButton} onClick={() => setSheetOpen(true)} aria-label="Change memory photo">
          <img className={styles.preview} src={previewUrl} alt="" />
        </button>
      ) : (
        <button type="button" className={styles.empty} onClick={() => setSheetOpen(true)}>
          Add Memory Photo
        </button>
      )}

      {sheetOpen ? (
        <PhotoActionSheet
          title="Memory Photo"
          hasPhoto={Boolean(previewUrl)}
          onFile={onPick}
          onRemove={onRemove}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </div>
  )
}
