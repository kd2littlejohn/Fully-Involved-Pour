import styles from './StatTile.module.css'

interface StatTileProps {
  value: string | number
  label: string
}

export function StatTile({ value, label }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  )
}
