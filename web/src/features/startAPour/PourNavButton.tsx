import { usePourHub } from './usePourHub'
import styles from './PourNavButton.module.css'

interface PourNavButtonProps {
  /** 'bottom' = raised circular badge for the mobile bottom nav; 'top' = amber pill inline in the desktop header. */
  variant?: 'bottom' | 'top'
}

// The nav's own entry point into the shared Pour hub (see usePourHub) —
// tapping this opens the exact same Quick Pour / Pour Story / Blind Room /
// Compare chooser as Home's "Start a Pour" button, so there's one Pour
// workflow reachable from two places, not two workflows.
export function PourNavButton({ variant = 'bottom' }: PourNavButtonProps) {
  const hub = usePourHub()

  return (
    <>
      <button
        type="button"
        className={variant === 'top' ? styles.topButton : styles.bottomButton}
        onClick={hub.open}
        aria-haspopup="dialog"
      >
        {variant === 'top' ? (
          <>
            <span className={styles.topIcon} aria-hidden="true">
              🥃
            </span>
            Pour
          </>
        ) : (
          <>
            <span className={styles.bottomIcon} aria-hidden="true">
              🥃
            </span>
            Pour
          </>
        )}
      </button>

      {hub.modal}
    </>
  )
}
