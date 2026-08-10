import { registerSW } from 'virtual:pwa-register'

// A quiet, permanent breadcrumb — lets a real build be told apart from the
// previous one from devtools alone (no UI change), which is exactly what a
// release-freshness check needs to confirm.
console.info('[FIP] pwaUpdate ready')

// Per the approved release-freshness policy: check conservatively, not on
// every hash-route change (this is a HashRouter app, so real navigations
// that would otherwise trigger the browser's own update check essentially
// never happen once the app is open).
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 60 minutes

// Safety net only — normally the real `controllerchange`-driven signal
// (surfaced here as onNeedReload) fires promptly after we ask the waiting
// worker to skip waiting. This build intentionally omits Workbox's
// `clientsClaim()` (registerType: 'prompt') so an update never silently
// takes over an already-open tab; the tradeoff is that the "this worker is
// now in control" signal for an already-open tab isn't fully guaranteed by
// spec, so this bounded fallback guarantees the reload still happens.
const RELOAD_FALLBACK_MS = 3000

export interface PwaUpdateController {
  /** Call only from an explicit user action (e.g. "Refresh Now"). Reloads exactly once. */
  refresh: () => Promise<void>
  /** Stops the periodic/visibility-triggered checks. Call on unmount. */
  teardown: () => void
}

// Wires the app into vite-plugin-pwa's registerType:'prompt' flow. Never
// reloads on its own — onNeedRefresh only tells the caller (the update
// banner) that a version is available; the page only ever reloads if the
// caller later invokes the returned `refresh()`.
export function initPwaUpdate(onNeedRefresh: () => void): PwaUpdateController {
  let registrationRef: ServiceWorkerRegistration | undefined
  let intervalId: ReturnType<typeof setInterval> | undefined
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined
  let reloaded = false
  let refreshRequested = false

  function performReload() {
    if (reloaded) return
    reloaded = true
    if (fallbackTimer) clearTimeout(fallbackTimer)
    window.location.reload()
  }

  function checkForUpdate() {
    // A failed check just means we try again next interval/visibility
    // change — never surfaced to the user, never blocks anything.
    registrationRef?.update().catch(() => undefined)
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') checkForUpdate()
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      onNeedRefresh()
    },
    onNeedReload() {
      performReload()
    },
    onRegisteredSW(_swUrl, registration) {
      registrationRef = registration
      if (registration) {
        intervalId = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
      }
    },
  })

  document.addEventListener('visibilitychange', handleVisibilityChange)

  async function refresh() {
    if (refreshRequested) return
    refreshRequested = true
    await updateSW()
    fallbackTimer = setTimeout(performReload, RELOAD_FALLBACK_MS)
  }

  function teardown() {
    if (intervalId) clearInterval(intervalId)
    if (fallbackTimer) clearTimeout(fallbackTimer)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  return { refresh, teardown }
}
