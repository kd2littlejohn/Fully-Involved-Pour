import type { ReactNode } from 'react'
import styles from './Badge.module.css'

interface BadgeProps {
  tone?: 'default' | 'amber' | 'brass'
  children: ReactNode
}

export function Badge({ tone = 'default', children }: BadgeProps) {
  const toneClass = tone === 'default' ? '' : styles[tone]
  return <span className={[styles.badge, toneClass].filter(Boolean).join(' ')}>{children}</span>
}
