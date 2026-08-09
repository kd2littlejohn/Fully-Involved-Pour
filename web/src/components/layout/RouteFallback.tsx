import styles from './RouteFallback.module.css'

export function RouteFallback() {
  return (
    <div className={styles.wrap} role="status" aria-label="Loading">
      <span className={styles.spinner} />
    </div>
  )
}
