import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './SecondaryActionCard.module.css'

interface SecondaryActionCardProps {
  icon: ReactNode
  title: string
  subtitle: string
  onClick?: () => void
  to?: string
}

// Shared trigger styling for Home's two secondary actions (What Should I
// Pour? / Add a Bottle) — an icon + title + subtitle outlined card instead
// of a plain button, matching the approved Home mockup. Renders as a Link
// when `to` is given, otherwise a button (What Should I Pour opens a modal,
// so it has no real destination URL).
export function SecondaryActionCard({ icon, title, subtitle, onClick, to }: SecondaryActionCardProps) {
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.title}>{title}</span>
      <span className={styles.subtitle}>{subtitle}</span>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={styles.card}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={styles.card} onClick={onClick}>
      {content}
    </button>
  )
}
