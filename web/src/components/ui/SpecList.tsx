import type { ReactNode } from 'react'
import styles from './SpecList.module.css'

export interface SpecRow {
  label: string
  value: ReactNode
}

export function SpecList({ rows }: { rows: SpecRow[] }) {
  return (
    <div className={styles.list}>
      {rows.map((row) => (
        <div className={styles.row} key={row.label}>
          <span className={styles.label}>{row.label}</span>
          <span className={styles.value}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}
