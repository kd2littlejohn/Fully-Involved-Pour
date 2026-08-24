import { getInitials } from './BottlePlaceholder'
import styles from './PersonAvatar.module.css'

interface PersonAvatarProps {
  name: string
  photoUrl?: string
  size?: number
  // When given, the avatar becomes a tappable button (e.g. to open the
  // photo action sheet) — otherwise it's purely decorative.
  onClick?: () => void
  className?: string
}

// A reusable "Poured With" contact avatar — photo when the person has one,
// initials on a warm gradient otherwise. Always circular; never used for
// bottle photos or pour memory photos, which have their own distinct
// treatments (never circular, never cropped to a small avatar frame).
export function PersonAvatar({ name, photoUrl, size = 36, onClick, className }: PersonAvatarProps) {
  const style = { width: size, height: size }
  const content = photoUrl ? (
    <img className={styles.image} src={photoUrl} alt="" style={style} />
  ) : (
    <span className={styles.fallback} style={{ ...style, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {getInitials(name)}
    </span>
  )

  if (onClick) {
    return (
      <button type="button" className={[styles.button, className].filter(Boolean).join(' ')} style={style} onClick={onClick} aria-label={`Change ${name}’s photo`}>
        {content}
      </button>
    )
  }

  return (
    <span className={[styles.wrap, className].filter(Boolean).join(' ')} style={style}>
      {content}
    </span>
  )
}
