import { type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import styles from './PhotoActionSheet.module.css'

interface PhotoActionSheetProps {
  title: string
  // Whether a photo already exists — Take/Choose Photo double as "Change
  // Photo" when true (picking either simply replaces it); Remove Photo only
  // shows up once there's something to remove.
  hasPhoto: boolean
  onFile: (file: File) => void
  onRemove?: () => void
  onClose: () => void
}

// Shared Take Photo / Choose Photo / Remove Photo action sheet — reused by
// both the "Poured With" contact avatar picker and the pour Memory Photo
// field, so there's exactly one photo-picking UI pattern in the app, not
// two separate pipelines.
export function PhotoActionSheet({ title, hasPhoto, onFile, onRemove, onClose }: PhotoActionSheetProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      onFile(file)
      onClose()
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className={styles.actions}>
        <label className={styles.action}>
          {hasPhoto ? 'Take New Photo' : 'Take Photo'}
          <input type="file" accept="image/*" capture="environment" className={styles.hiddenInput} onChange={handleChange} />
        </label>
        <label className={styles.action}>
          {hasPhoto ? 'Choose New Photo' : 'Choose Photo'}
          <input type="file" accept="image/*" className={styles.hiddenInput} onChange={handleChange} />
        </label>
        {hasPhoto && onRemove ? (
          <Button
            variant="ghost"
            className={styles.removeAction}
            onClick={() => {
              onRemove()
              onClose()
            }}
          >
            Remove Photo
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
