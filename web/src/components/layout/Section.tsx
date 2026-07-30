import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './Section.module.css'

interface SectionProps {
  title: string
  viewAllHref?: string
  children: ReactNode
}

export function Section({ title, viewAllHref, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {viewAllHref ? (
          <Link className={styles.viewAll} to={viewAllHref}>
            View all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function SectionRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>
}
