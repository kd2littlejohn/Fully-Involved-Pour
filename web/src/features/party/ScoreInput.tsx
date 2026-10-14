import styles from './scoring.module.css'

interface ScoreInputProps {
  id: string
  label: string
  hint?: string
  value: number | null
  onChange: (value: number) => void
  describe?: (value: number | null) => string
  disabled?: boolean
  large?: boolean
}

// 0–10 rating in half-point steps on a native range input: keyboard and
// screen-reader friendly by default, and a big touch target on phones.
// `null` means "not rated yet" (shown as such, never as 0).
export function ScoreInput({ id, label, hint, value, onChange, describe, disabled, large }: ScoreInputProps) {
  const display = value === null ? '—' : value.toFixed(value % 1 === 0 ? 0 : 1)
  const words = describe?.(value)
  return (
    <div className={large ? `${styles.score} ${styles.scoreLarge}` : styles.score}>
      <div className={styles.scoreHeader}>
        <label htmlFor={id} className={styles.scoreLabel}>
          {label}
          {hint ? <span className={styles.scoreHint}>{hint}</span> : null}
        </label>
        <span className={styles.scoreValue} aria-hidden="true">
          {display}
          <span className={styles.scoreMax}>/10</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={value ?? 5}
        disabled={disabled}
        className={value === null ? `${styles.range} ${styles.rangeUnset}` : styles.range}
        aria-valuetext={value === null ? 'Not rated yet' : `${display} out of 10${words ? `, ${words}` : ''}`}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => {
          // A tap on the untouched slider's resting thumb fires no change
          // event; count it as choosing 5.
          if (value === null) onChange(Number((e.target as HTMLInputElement).value))
        }}
      />
      {words ? <span className={styles.scoreWords}>{words}</span> : null}
    </div>
  )
}
