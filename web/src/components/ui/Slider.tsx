import styles from './Slider.module.css'

interface SliderProps {
  id: string
  label: string
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  // Short guidance text for the value the slider is currently at — e.g.
  // explaining what "high complexity" actually means so a rater isn't left
  // guessing. Purely descriptive, never affects scoring.
  describeValue?: (value: number, max: number) => string | undefined
}

export function Slider({ id, label, max, step = 0.1, value, onChange, describeValue }: SliderProps) {
  const hint = describeValue?.(value, max)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <label className={styles.label} htmlFor={id}>
            {label}
          </label>
          <div className={styles.max}>Max {max} pts</div>
        </div>
        <span className={styles.value}>
          {value.toFixed(1)}
          <span className={styles.valueMax}> / {max}</span>
        </span>
      </div>
      <input
        id={id}
        className={styles.input}
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value.toFixed(1)} out of ${max}`}
      />
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  )
}
