import { NavLink } from 'react-router-dom'
import { NAV_ITEMS, type NavItem } from './navItems'
import { PourNavButton } from '../../features/startAPour/PourNavButton'
import styles from './BottomNav.module.css'

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
    >
      <span className={styles.dot} aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}

// Order is Home | My Bar | Pour | Journey | Profile — Pour sits between the
// first two route items and the last two (see navItems.ts for why it isn't
// itself a NAV_ITEMS entry).
export function BottomNav() {
  return (
    <nav className={styles.bar} aria-label="Primary">
      {NAV_ITEMS.slice(0, 2).map((item) => (
        <NavItemLink key={item.path} item={item} />
      ))}
      <PourNavButton variant="bottom" />
      {NAV_ITEMS.slice(2).map((item) => (
        <NavItemLink key={item.path} item={item} />
      ))}
    </nav>
  )
}
