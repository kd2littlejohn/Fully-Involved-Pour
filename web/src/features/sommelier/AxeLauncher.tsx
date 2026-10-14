import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { resolveRouteContext } from './axeContext'
import { useSommelier } from './SommelierProvider'
import { AxeSymbol } from './AxeMark'
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

// The floating "Ask AXE" entry point. Only full-screen flows without the
// bottom nav (the Blind reveal) use it: inside the app shell AXE is the
// centre nav tab, so nothing floats over content. No idle animation, no auto-open;
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
      <AxeSymbol size={34} className={styles.mark} />
      <span className={styles.label}>Ask AXE</span>
    </button>
  )
}

export function AxeLauncher({ floating = true }: { floating?: boolean } = {}) {
  const { closeAxe } = useSommelier()
  // Leaving every screen that has a launcher (e.g. into a full-screen flow
  // like the Blind tasting itself) closes AXE rather than leaving a drawer
  // floating over a screen it wasn't opened for. The conversation is kept.
  useEffect(() => closeAxe, [closeAxe])
  return (
    <>
      <AxeRouteContext />
      {floating ? <AskAxeButton /> : null}
    </>
  )
}
