import { NavLink } from 'react-router-dom'
import compassMark from '../../assets/compass-mark.png'
import { NAV_ITEMS } from './navItems'
import { PourNavButton } from '../../features/startAPour/PourNavButton'
import styles from './TopNav.module.css'

// Same five destinations as the mobile bottom nav, same order: Home | My Bar
// | Pour | Journey | Profile.
export function TopNav() {
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
      </ul>
      <button className={styles.profile} aria-label="Account" type="button" />
    </header>
  )
}
