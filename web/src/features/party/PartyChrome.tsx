import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import fipIcon from '../../assets/brand/fip-icon.svg'
import { RouteFallback } from '../../components/layout/RouteFallback'
import styles from './party.module.css'

// Full-screen Party Mode page: the espresso backdrop, an FIP-branded top
// bar and a readable-width column. Used by every party route that sits
// outside AppShell (guests aren't FIP users, so there's no bottom nav).
export function PartyPage({
  children,
  back,
  wide = false,
  right,
}: {
  children: ReactNode
  back?: { to: string; label: string }
  wide?: boolean
  right?: ReactNode
}) {
  return (
    <div className={styles.page}>
      <div className={wide ? `${styles.inner} ${styles.wide}` : styles.inner}>
        <header className={styles.topBar}>
          {back ? (
            <Link to={back.to} className={styles.backLink}>
              <span aria-hidden="true">‹</span> {back.label}
            </Link>
          ) : (
            <span className={styles.brand}>
              <img className={styles.brandMark} src={fipIcon} alt="" aria-hidden="true" />
              Fully Involved Pour · Party
            </span>
          )}
          {right}
        </header>
        <main className={styles.stack} style={{ gap: 'var(--fip-space-5)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export function PartyLoading() {
  return (
    <div className={styles.page}>
      <RouteFallback />
    </div>
  )
}

export function PartyMessage({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <PartyPage>
      <section className={`${styles.card} ${styles.cardWarm}`} aria-live="polite">
        <h1 className={styles.sectionTitle}>{title}</h1>
        <p className={styles.subtitle}>{message}</p>
        {action ? <div className={styles.row}>{action}</div> : null}
      </section>
    </PartyPage>
  )
}

export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleText}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {hint ? (
          <span id={`${id}-hint`} className={styles.muted}>
            {hint}
          </span>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={styles.switch}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}
