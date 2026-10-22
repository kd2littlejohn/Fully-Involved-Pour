import styles from './AddBottleEntryChoice.module.css'

interface AddBottleEntryChoiceProps {
  onScanBarcode: () => void
  onScanLabel: () => void
  onManualEntry: () => void
}

export function AddBottleEntryChoice({ onScanBarcode, onScanLabel, onManualEntry }: AddBottleEntryChoiceProps) {
  return (
    <div className={styles.list}>
      <button type="button" className={`${styles.card} ${styles.primary}`} onClick={onScanBarcode}>
        <span className={styles.icon} aria-hidden="true">
          ▥
        </span>
        <span className={styles.text}>
          <span className={styles.title}>Scan Barcode</span>
          <span className={styles.description}>Point your camera at the UPC. Pick your exact release, or add another of one you own.</span>
        </span>
      </button>
      <button type="button" className={styles.card} onClick={onScanLabel}>
        <span className={styles.icon} aria-hidden="true">
          ✨
        </span>
        <span className={styles.text}>
          <span className={styles.title}>Scan Label with AI</span>
          <span className={styles.description}>Photograph the label and let AI read the details.</span>
        </span>
      </button>
      <button type="button" className={styles.card} onClick={onManualEntry}>
        <span className={styles.icon} aria-hidden="true">
          ✎
        </span>
        <span className={styles.text}>
          <span className={styles.title}>Manual Entry</span>
          <span className={styles.description}>Type in the bottle's details yourself.</span>
        </span>
      </button>
    </div>
  )
}
