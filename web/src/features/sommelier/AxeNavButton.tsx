import { NavLink } from 'react-router-dom'
import { AxeSymbol } from './AxeMark'
import styles from './AxeNavButton.module.css'

interface AxeNavButtonProps {
  /** 'bottom' = raised centre tab in the mobile bottom nav; 'top' = gold pill in the desktop header. */
  variant?: 'bottom' | 'top'
}

// The centre nav destination: the AXE Hub (/axe). It replaced the old Pour
// tab; every Pour workflow lives on inside the Hub's "Start a Pour" menu,
// and /pour still lands there.
export function AxeNavButton({ variant = 'bottom' }: AxeNavButtonProps) {
  if (variant === 'top') {
    return (
      <NavLink to="/axe" className={({ isActive }) => (isActive ? `${styles.top} ${styles.topActive}` : styles.top)}>
        <AxeSymbol size={30} />
        AXE
      </NavLink>
    )
  }
  return (
    <NavLink to="/axe" className={({ isActive }) => (isActive ? `${styles.bottom} ${styles.bottomActive}` : styles.bottom)}>
      <span className={styles.badge}>
        <AxeSymbol size={46} />
      </span>
      AXE
    </NavLink>
  )
}
