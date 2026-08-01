import type { ReactNode } from 'react'
import styles from './Field.module.css'

interface FieldProps {
  label: string
  htmlFor: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, required = false, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
    </div>
  )
}

export const controlClassName = styles.control
