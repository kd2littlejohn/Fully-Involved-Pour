import { usePourQuickActions } from './usePourQuickActions'
import styles from './PourNavButton.module.css'

interface PourNavButtonProps {
  /** 'bottom' = raised circular badge for the mobile bottom nav; 'top' = amber pill inline in the desktop header. */
  variant?: 'bottom' | 'top'
}

// The nav's own entry point into the Pour quick-action sheet (see
// usePourQuickActions) — Record a Pour, Start a Blind Tasting, Add a
// Bottle, Update an Open Bottle, Add to an Infinity Bottle, each routed
// into its existing feature.
export function PourNavButton({ variant = 'bottom' }: PourNavButtonProps) {
  const hub = usePourQuickActions()

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
