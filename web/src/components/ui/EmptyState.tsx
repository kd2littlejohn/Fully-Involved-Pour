import type { ReactNode } from 'react'
import compassMark from '../../assets/compass-mark.png'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  title: string
  message: string
  action?: ReactNode
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <img className={styles.mark} src={compassMark} alt="" aria-hidden="true" />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
