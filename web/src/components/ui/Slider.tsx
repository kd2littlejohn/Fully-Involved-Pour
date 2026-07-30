import styles from './Slider.module.css'

interface SliderProps {
  id: string
  label: string
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
}

export function Slider({ id, label, max, step = 0.1, value, onChange }: SliderProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <span className={styles.value}>
          {value.toFixed(1)} / {max}
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
    </div>
  )
}
