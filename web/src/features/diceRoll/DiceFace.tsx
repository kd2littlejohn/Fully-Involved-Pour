import styles from './DiceFace.module.css'

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [25, 25],
    [75, 75],
  ],
  3: [
    [25, 25],
    [50, 50],
    [75, 75],
  ],
  4: [
    [25, 25],
    [75, 25],
    [25, 75],
    [75, 75],
  ],
  5: [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ],
  6: [
    [25, 25],
    [75, 25],
    [25, 50],
    [75, 50],
    [25, 75],
    [75, 75],
  ],
}

interface DiceFaceProps {
  value: number
  size?: number
  rolling?: boolean
}

export function DiceFace({ value, size = 80, rolling = false }: DiceFaceProps) {
  const pips = PIP_LAYOUTS[value] ?? PIP_LAYOUTS[1] ?? []

  return (
    <svg
      className={rolling ? `${styles.face} ${styles.rolling}` : styles.face}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Die showing ${value}`}
    >
      <rect x="4" y="4" width="92" height="92" rx="18" className={styles.body} />
      {pips.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" className={styles.pip} />
      ))}
    </svg>
  )
}
