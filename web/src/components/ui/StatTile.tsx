import styles from './StatTile.module.css'

interface StatTileProps {
  value: string | number
  label: string
  // A small extra derived fact shown under the label — e.g. proof's ABV
  // equivalent. Optional since most tiles are just value + label.
  sublabel?: string
}

export function StatTile({ value, label, sublabel }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
      {sublabel ? <div className={styles.sublabel}>{sublabel}</div> : null}
    </div>
  )
}
