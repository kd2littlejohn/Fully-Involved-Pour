import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../data/firebase'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { clearUserCache } from '../../data/clearUserCache'
import { downloadUserDataExport } from '../../features/profile/dataExport'
import { PrivacyControls } from '../../features/friends/PrivacyControls'
import homeHeroImage from '../../assets/home-hero.webp'
import styles from './SettingsPage.module.css'

const BACK_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PRIVACY_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
)

const NOTIFICATIONS_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const ACCOUNT_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const EXPORT_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 3v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const HELP_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.35-1 .8-1 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" />
  </svg>
)

const SIGN_OUT_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
    >
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { userDoc } = useUserData()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exported, setExported] = useState(false)

  function toggle(id: string) {
    setExpanded((current) => (current === id ? null : id))
  }

  function handleExport() {
    downloadUserDataExport(userDoc)
    setExported(true)
  }

  async function handleSignOut() {
    const uid = user?.uid
    await signOut(auth)
    if (uid) clearUserCache(uid)
    navigate('/')
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Back">
          {BACK_ICON}
        </button>
        <h1 className={styles.title}>Settings</h1>
      </header>

      <div className={styles.rows}>
        <div className={styles.row}>
          <button type="button" className={styles.rowButton} onClick={() => toggle('privacy')} aria-expanded={expanded === 'privacy'}>
            <span className={styles.icon}>{PRIVACY_ICON}</span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Privacy</span>
              <span className={styles.rowDescription}>How your bar and pours are kept private</span>
            </span>
            <ChevronIcon open={expanded === 'privacy'} />
          </button>
          {expanded === 'privacy' ? (
            <div className={styles.detail}>
              <p className={styles.detailIntro}>
                Every account starts fully private. Choosing "Friends" or "FIP users" below only shares exactly that category —
                nothing else.
              </p>
              <PrivacyControls />
            </div>
          ) : null}
        </div>

        <div className={styles.row}>
          <button
            type="button"
            className={styles.rowButton}
            onClick={() => toggle('notifications')}
            aria-expanded={expanded === 'notifications'}
          >
            <span className={styles.icon}>{NOTIFICATIONS_ICON}</span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Notifications</span>
              <span className={styles.rowDescription}>Blind Room invites and reminders</span>
            </span>
            <ChevronIcon open={expanded === 'notifications'} />
          </button>
          {expanded === 'notifications' ? (
            <p className={styles.detail}>Push and email notifications aren&rsquo;t built yet — this is coming in a future update.</p>
          ) : null}
        </div>

        <div className={styles.row}>
          <button type="button" className={styles.rowButton} onClick={() => toggle('account')} aria-expanded={expanded === 'account'}>
            <span className={styles.icon}>{ACCOUNT_ICON}</span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Account</span>
              <span className={styles.rowDescription}>Signed in with Google</span>
            </span>
            <ChevronIcon open={expanded === 'account'} />
          </button>
          {expanded === 'account' ? (
            <p className={styles.detail}>
              {user?.displayName ? `${user.displayName} — ` : ''}
              {user?.email ?? 'No email on file.'}
            </p>
          ) : null}
        </div>

        <div className={styles.row}>
          <button type="button" className={styles.rowButton} onClick={handleExport}>
            <span className={styles.icon}>{EXPORT_ICON}</span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Data & Exports</span>
              <span className={styles.rowDescription}>
                {exported ? 'Downloaded — check your downloads folder.' : 'Download your bar as a JSON file'}
              </span>
            </span>
          </button>
        </div>

        <div className={styles.row}>
          <a className={styles.rowButton} href="mailto:support@fullyinvolvedpour.com">
            <span className={styles.icon}>{HELP_ICON}</span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Help & Support</span>
              <span className={styles.rowDescription}>Email us with a question or issue</span>
            </span>
            <ChevronIcon open={false} />
          </a>
        </div>
      </div>

      <button type="button" className={styles.signOutRow} onClick={() => void handleSignOut()}>
        <span className={styles.icon}>{SIGN_OUT_ICON}</span>
        <span className={styles.rowTitle}>Sign Out</span>
      </button>

      <div className={styles.brandFooter}>
        <img className={styles.brandImage} src={homeHeroImage} alt="" />
        <p className={styles.tagline}>Fully Involved Pour</p>
        <p className={styles.tagline}>Drink What You Enjoy. Share What Matters.</p>
      </div>
    </div>
  )
}
