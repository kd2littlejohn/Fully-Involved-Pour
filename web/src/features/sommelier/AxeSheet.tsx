import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from 'react'
import { useSommelier } from './SommelierProvider'
import { SommelierPanel } from './SommelierPanel'
import styles from './AxeSheet.module.css'
import { AxeSymbol } from './AxeMark'

const DESKTOP_QUERY = '(min-width: 900px)'

function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches
}

// Any other open <dialog> in this app is a Modal (always showModal()'d,
// see components/ui/Modal.tsx), which makes everything outside it inert.
function anotherModalIsOpen(self: HTMLDialogElement): boolean {
  return Array.from(document.querySelectorAll('dialog[open]')).some((dialog) => dialog !== self)
}

// AXE's container: a bottom sheet on mobile, a side drawer on desktop —
// the same native <dialog>, styled per breakpoint (AxeSheet.module.css).
//
// - Mobile: showModal() — a focused sheet over the page; the page and its
//   bottom nav stay mounted underneath, untouched.
// - Desktop: show() — a non-modal drawer, so the page beside it stays
//   usable. Exception: when a Modal (e.g. the Pour Story wizard) is already
//   open, showModal() is the only way to stack above it in the top layer.
//   The wizard stays mounted underneath either way, so its unsaved form
//   state is never lost by opening AXE.
export function AxeSheet() {
  const { isOpen, closeAxe } = useSommelier()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!isDesktop() || anotherModalIsOpen(dialog)) {
        dialog.showModal()
      } else if (typeof dialog.show === 'function') {
        dialog.show()
      } else {
        dialog.setAttribute('open', '')
      }
      // Desktop: straight to the input. Mobile: focus the sheet itself so
      // the on-screen keyboard doesn't jump up uninvited.
      const target = isDesktop() ? dialog.querySelector<HTMLElement>('[data-axe-input]') : dialog
      target?.focus()
    } else if (!isOpen && dialog.open) {
      dialog.close()
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
    }
  }, [isOpen])

  // Track the on-screen keyboard while open on mobile, so the input is
  // never hidden behind it (iOS Safari doesn't resize the layout viewport).
  useEffect(() => {
    const dialog = dialogRef.current
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null
    if (!isOpen || !dialog || !viewport) return
    function update() {
      if (!dialog || !viewport) return
      const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      dialog.style.setProperty('--axe-keyboard', `${Math.round(keyboard)}px`)
      dialog.style.setProperty('--axe-viewport', `${Math.round(viewport.height)}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [isOpen])

  function handleCancel(event: SyntheticEvent) {
    // Escape on a modal dialog — route it through state so open/closed
    // never drifts from what the provider thinks.
    event.preventDefault()
    closeAxe()
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    // A click landing on the <dialog> itself (not its content) hit the
    // ::backdrop — same convenience Modal offers, alongside Escape and ×.
    if (event.target === dialogRef.current) closeAxe()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    // Non-modal (desktop drawer) dialogs don't get native Escape handling.
    if (event.key === 'Escape') {
      event.stopPropagation()
      closeAxe()
    }
  }

  return (
    // Backdrop click is a convenience on top of Escape and the × button.
    // oxlint-disable-next-line click-events-have-key-events no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby="axe-title"
      onCancel={handleCancel}
      onClose={() => {
        if (isOpen) closeAxe()
      }}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      tabIndex={-1}
    >
      <div className={styles.grabber} aria-hidden="true" />
      <header className={styles.header}>
        <AxeSymbol size={40} className={styles.logo} />
        <div className={styles.brand}>
          <h2 id="axe-title" className={styles.wordmark}>
            AXE
          </h2>
          <p className={styles.tagline}>Your Personal Sommelier</p>
        </div>
        <button type="button" className={styles.close} onClick={closeAxe} aria-label="Close AXE">
          ×
        </button>
      </header>
      <SommelierPanel />
    </dialog>
  )
}
