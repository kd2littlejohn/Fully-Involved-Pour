import styles from './BottlePlaceholder.module.css'

interface BottlePlaceholderProps {
  // Hides the "No Photo" label for tight spaces like list-row thumbnails.
  compact?: boolean
  // When given, renders the bottle's initials instead of the generic icon.
  name?: string
}

// Exported for reuse by PersonAvatar.tsx, which needs the exact same
// letters-over-digits initials logic for "Poured With" contact avatars.
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  // Prefer words with letters (skips age statements like "12" or "10") so
  // "Redbreast 12" reads as "RE", not "R1".
  const lettered = words.filter((word) => /[a-zA-Z]/.test(word))
  const [first, second] = lettered.length > 0 ? lettered : words
  if (!first) return ''
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

export function BottlePlaceholder({ compact = false, name }: BottlePlaceholderProps) {
  const initials = name ? getInitials(name) : ''

  if (initials) {
    return (
      <div className={compact ? `${styles.avatar} ${styles.avatarCompact}` : styles.avatar} aria-hidden="true">
        <svg className={styles.watermark} viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M19 2h10v9.5c0 1.4.6 2.7 1.7 3.6 2.8 2.4 4.3 5.9 4.3 9.6v31.3c0 3.3-2.7 6-6 6H19c-3.3 0-6-2.7-6-6V24.7c0-3.7 1.5-7.2 4.3-9.6A4.7 4.7 0 0 0 19 11.5V2Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M17 2h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className={styles.initials}>{initials}</span>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <svg className={styles.icon} viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M19 2h10v9.5c0 1.4.6 2.7 1.7 3.6 2.8 2.4 4.3 5.9 4.3 9.6v31.3c0 3.3-2.7 6-6 6H19c-3.3 0-6-2.7-6-6V24.7c0-3.7 1.5-7.2 4.3-9.6A4.7 4.7 0 0 0 19 11.5V2Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M17 2h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M13 30h22" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
      </svg>
      {compact ? null : <span className={styles.label}>No Photo</span>}
    </div>
  )
}
