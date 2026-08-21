import { NavLink } from 'react-router-dom'
import compassMark from '../../assets/compass-mark.png'
import { NAV_ITEMS } from './navItems'
import { PourNavButton } from '../../features/startAPour/PourNavButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useFriendRequests } from '../../features/friends/useFriendRequests'
import styles from './TopNav.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

// Same five destinations as the mobile bottom nav, same order: Home | My Bar
// | Pour | Journey | Friends. Profile isn't a nav destination — it's reached
// via the avatar button at the far right, same as the mobile MobileTopBar.
export function TopNav() {
  const { user } = useAuth()
  const { profile } = useUserData()
  const { incoming } = useFriendRequests(user?.uid)
  const displayName = profile?.displayName || user?.displayName || 'Account'

  return (
    <header className={styles.bar}>
      <NavLink to="/" className={styles.brand} end>
        <img className={styles.brandMark} src={compassMark} alt="" aria-hidden="true" />
        <span className={styles.brandWord}>Fully Involved Pour</span>
      </NavLink>
      <ul className={styles.links}>
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
        <li>
          <PourNavButton variant="top" />
        </li>
        {NAV_ITEMS.slice(2).map((item) => (
          <li key={item.path} className={styles.linkWrap}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
            >
              {item.label}
            </NavLink>
            {item.path === '/friends' && incoming.length > 0 ? <span className={styles.linkBadge}>{incoming.length}</span> : null}
          </li>
        ))}
      </ul>
      <NavLink to="/profile" className={styles.profile} aria-label={`${displayName}'s profile`}>
        {profile?.photoURL ? (
          <img className={styles.profileImage} src={profile.photoURL} alt="" />
        ) : (
          <span className={styles.profileInitials} aria-hidden="true">
            {initials(displayName)}
          </span>
        )}
      </NavLink>
    </header>
  )
}
