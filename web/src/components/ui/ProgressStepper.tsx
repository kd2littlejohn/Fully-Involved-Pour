import styles from './ProgressStepper.module.css'

interface ProgressStepperProps {
  labels: string[]
  activeIndex: number
}

export function ProgressStepper({ labels, activeIndex }: ProgressStepperProps) {
  return (
    <ul className={styles.stepper} aria-label="Progress">
      {labels.map((label, index) => (
        <li className={styles.step} key={label}>
          <span
            className={
              index === activeIndex
                ? `${styles.circle} ${styles.circleActive}`
                : index < activeIndex
                  ? `${styles.circle} ${styles.circleDone}`
                  : styles.circle
            }
            aria-current={index === activeIndex ? 'step' : undefined}
          >
            {index < activeIndex ? '✓' : index + 1}
          </span>
          <span className={styles.label}>{label}</span>
          {index < labels.length - 1 ? (
            <span className={index < activeIndex ? `${styles.line} ${styles.lineDone}` : styles.line} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}
