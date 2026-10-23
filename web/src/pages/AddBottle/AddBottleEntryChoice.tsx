import type { ChangeEvent } from 'react'
import styles from './AddBottleEntryChoice.module.css'

interface AddBottleEntryChoiceProps {
  /** A label photo was taken or chosen: continue to the form and let AXE read it. */
  onScanLabel: (photo: File) => void
  onManualEntry: () => void
  /** Shown only when the Scan Barcode feature is switched on (addBottleFeatures). */
  onScanBarcode?: () => void
}

export function AddBottleEntryChoice({ onScanLabel, onManualEntry, onScanBarcode }: AddBottleEntryChoiceProps) {
  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onScanLabel(file)
  }

  return (
    <div className={styles.list}>
      {/* No `capture`: on iPhone this offers both Take Photo and Photo Library. */}
      <label className={`${styles.card} ${styles.primary}`}>
        <span className={styles.icon} aria-hidden="true">
          ✨
        </span>
        <span className={styles.text}>
          <span className={styles.title}>Scan Label with AXE</span>
          <span className={styles.description}>Take or choose a photo of the label. AXE fills in the bottle, proof, batch and pick details.</span>
        </span>
        <input type="file" accept="image/*" className={styles.hiddenInput} onChange={handlePhoto} />
      </label>
      <button type="button" className={styles.card} onClick={onManualEntry}>
        <span className={styles.icon} aria-hidden="true">
          ✎
        </span>
        <span className={styles.text}>
          <span className={styles.title}>Manual Entry</span>
          <span className={styles.description}>Type in the bottle's details yourself.</span>
        </span>
      </button>
      {onScanBarcode ? (
        <button type="button" className={styles.card} onClick={onScanBarcode}>
          <span className={styles.icon} aria-hidden="true">
            ▥
          </span>
          <span className={styles.text}>
            <span className={styles.title}>Scan Barcode</span>
            <span className={styles.description}>Point your camera at the UPC. Pick your exact release, or add another of one you own.</span>
          </span>
        </button>
      ) : null}
    </div>
  )
}
