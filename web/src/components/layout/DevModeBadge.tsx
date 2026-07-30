import { isMockAuthEnabled } from '../../data/devMode'
import styles from './DevModeBadge.module.css'

// Visible so it's never ambiguous whether a screenshot is showing real
// Google-authenticated data or dev fixture data. Only renders when
// VITE_MOCK_AUTH=true (never in a production build).
export function DevModeBadge() {
  if (!isMockAuthEnabled()) return null
  return <div className={styles.badge}>Dev Mode — Mock Data</div>
}
