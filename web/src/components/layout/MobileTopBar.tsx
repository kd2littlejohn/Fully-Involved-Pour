import { NavLink } from 'react-router-dom'
import compassMark from '../../assets/compass-mark-transparent.png'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import styles from './MobileTopBar.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

// Mobile has no persistent top nav (TopNav.tsx only renders at >=900px) —
// Profile lost its permanent bottom-nav slot to Friends in the 2026-08-21
// redesign, so this slim bar is the one place on every mobile screen where
// the avatar (→ Profile) always lives, matching "don't make Profile hard to
// find." Renders regardless of sign-in state; signed out it just links
// straight to /profile, which shows its own sign-in prompt.
export function MobileTopBar() {
  const { user } = useAuth()
  const { profile } = useUserData()
  const displayName = profile?.displayName || user?.displayName || 'Account'

  return (
    <div className={styles.bar}>
      <NavLink to="/" className={styles.brand} end aria-label="Home">
        <img className={styles.brandMark} src={compassMark} alt="" aria-hidden="true" />
      </NavLink>
      <NavLink to="/profile" className={styles.profile} aria-label={user ? `${displayName}'s profile` : 'Sign in'}>
        {profile?.photoURL ? (
          <img className={styles.profileImage} src={profile.photoURL} alt="" />
        ) : (
          <span className={styles.profileInitials} aria-hidden="true">
            {user ? initials(displayName) : '?'}
          </span>
        )}
      </NavLink>
    </div>
  )
}
