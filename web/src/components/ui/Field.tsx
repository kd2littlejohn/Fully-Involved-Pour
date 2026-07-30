import type { ReactNode } from 'react'
import styles from './Field.module.css'

interface FieldProps {
  label: string
  htmlFor: string
  children: ReactNode
}

export function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

export const controlClassName = styles.control
