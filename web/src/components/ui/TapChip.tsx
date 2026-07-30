import styles from './TapChip.module.css'

interface TapChipProps {
  label: string
  active: boolean
  onToggle: () => void
}

export function TapChip({ label, active, onToggle }: TapChipProps) {
  return (
    <button
      type="button"
      className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
      aria-pressed={active}
      onClick={onToggle}
    >
      {label}
    </button>
  )
}
