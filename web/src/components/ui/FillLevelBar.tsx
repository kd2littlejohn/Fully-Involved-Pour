import styles from './FillLevelBar.module.css'

interface FillLevelBarProps {
  percent: number
}

// A compact visual meter for a bottle's fill level — shared by Home's Open
// Bottles card and My Bar's bottle cards so both read the same at a glance.
export function FillLevelBar({ percent }: FillLevelBarProps) {
  return (
    <div className={styles.track} role="progressbar" aria-label="Fill level" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
  )
}
