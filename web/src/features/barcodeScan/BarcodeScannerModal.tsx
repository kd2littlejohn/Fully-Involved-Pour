import { Button } from '../../components/ui/Button'
import { useBarcodeScanner } from './useBarcodeScanner'
import styles from './BarcodeScannerModal.module.css'

interface BarcodeScannerModalProps {
  onDetected: (upc: string) => void
  onManualEntry: () => void
  onClose: () => void
}

export function BarcodeScannerModal({ onDetected, onManualEntry, onClose }: BarcodeScannerModalProps) {
  const { videoRef, status, errorMessage, restart } = useBarcodeScanner(true, onDetected)

  const showVideo = status === 'requesting' || status === 'scanning' || status === 'detected'

  return (
    <div className={styles.overlay} aria-label="Scan barcode">
      <div className={styles.header}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close scanner">
          ×
        </button>
        <span className={styles.title}>Scan UPC</span>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </div>

      <div className={styles.frame}>
        {showVideo ? (
          <>
            {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- live camera feed, not pre-recorded media */}
            <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
            <div className={styles.guide} aria-hidden="true">
              <div className={styles.guideBox} />
            </div>
          </>
        ) : (
          <div className={styles.messageState}>
            <p className={styles.messageTitle}>
              {status === 'permission-denied'
                ? "We need camera access to scan a barcode."
                : status === 'no-camera'
                  ? 'No camera was found on this device.'
                  : "Something went wrong starting the scanner."}
            </p>
            <p className={styles.messageBody}>
              {status === 'permission-denied'
                ? "Allow camera access in your browser's site settings, then try again — or just enter the bottle by hand."
                : errorMessage || 'You can still add this bottle without scanning.'}
            </p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {status === 'requesting' ? <p className={styles.hint}>Starting camera…</p> : null}
        {status === 'scanning' ? <p className={styles.hint}>Point your camera at the barcode.</p> : null}
        {status === 'detected' ? <p className={styles.hint}>Got it!</p> : null}

        <div className={styles.actions}>
          {status === 'permission-denied' || status === 'error' ? (
            <Button variant="secondary" onClick={restart}>
              Try Again
            </Button>
          ) : null}
          <Button variant={status === 'scanning' || status === 'requesting' ? 'ghost' : 'primary'} onClick={onManualEntry}>
            Enter Bottle Manually
          </Button>
        </div>
      </div>
    </div>
  )
}
