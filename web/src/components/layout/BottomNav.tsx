import { NavLink } from 'react-router-dom'
import { NAV_ITEMS, type NavItem } from './navItems'
import { AxeNavButton } from '../../features/sommelier/AxeNavButton'
import { useAuth } from '../../hooks/useAuth'
import { useFriendRequests } from '../../features/friends/useFriendRequests'
import styles from './BottomNav.module.css'

function NavItemLink({ item, badge }: { item: NavItem; badge?: number }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
    >
      <span className={styles.iconWrap}>
        <span className={styles.dot} aria-hidden="true" />
        {badge ? <span className={styles.badge}>{badge > 9 ? '9+' : badge}</span> : null}
      </span>
      {item.label}
    </NavLink>
  )
}

// Order is Home | My Bar | AXE | Journey | Friends — AXE sits between the
// first two route items and the last two (see navItems.ts).
export function BottomNav() {
  const { user } = useAuth()
  const { incoming } = useFriendRequests(user?.uid)

  return (
    <nav className={styles.bar} aria-label="Primary">
      {NAV_ITEMS.slice(0, 2).map((item) => (
        <NavItemLink key={item.path} item={item} />
      ))}
      <AxeNavButton variant="bottom" />
      {NAV_ITEMS.slice(2).map((item) => (
        <NavItemLink key={item.path} item={item} badge={item.path === '/friends' ? incoming.length : undefined} />
      ))}
    </nav>
  )
}
