import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import compassMark from '../../assets/compass-mark.png'
import { useAuth } from '../../hooks/useAuth'
import { resolveRouteContext } from './axeContext'
import { useSommelier } from './SommelierProvider'
import styles from './AxeLauncher.module.css'

// Keeps AXE's context in step with the current route. Reporting a route is
// pure state — it never sends anything to the AI on its own, so ordinary
// navigation costs nothing.
export function AxeRouteContext() {
  const { pathname } = useLocation()
  const { setRouteContext } = useSommelier()
  useEffect(() => {
    setRouteContext(resolveRouteContext(pathname))
  }, [pathname, setRouteContext])
  return null
}

// The subtle "Ask AXE" entry point — the real FIP compass mark (the same
// asset TopNav uses, never redrawn), floating above the bottom nav on
// mobile and in the corner on desktop. No idle animation, no auto-open;
// the only "active" cue is a gold ring while AXE is open.
export function AskAxeButton() {
  const { user } = useAuth()
  const { isOpen, openAxe, closeAxe } = useSommelier()
  if (!user) return null
  return (
    <button
      type="button"
      className={`${styles.button} ${isOpen ? styles.active : ''}`}
      onClick={() => (isOpen ? closeAxe() : openAxe())}
      aria-label="Ask AXE, your personal sommelier"
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      <img className={styles.mark} src={compassMark} alt="" aria-hidden="true" />
      <span className={styles.label}>Ask AXE</span>
    </button>
  )
}

export function AxeLauncher() {
  const { closeAxe } = useSommelier()
  // Leaving every screen that has a launcher (e.g. into a full-screen flow
  // like the Blind tasting itself) closes AXE rather than leaving a drawer
  // floating over a screen it wasn't opened for. The conversation is kept.
  useEffect(() => closeAxe, [closeAxe])
  return (
    <>
      <AxeRouteContext />
      <AskAxeButton />
    </>
  )
}
