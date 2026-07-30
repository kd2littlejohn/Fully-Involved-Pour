import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import styles from './BottomNav.module.css'

export function BottomNav() {
  return (
    <nav className={styles.bar} aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.linkActive}` : styles.link
          }
        >
          <span className={styles.dot} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
