import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // onClose is typically a fresh inline function every render. Keeping it out
  // of the effect's dependency array (via a ref) means the effect below only
  // runs on true mount/unmount, not on every parent re-render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleNativeClose() {
      onCloseRef.current()
    }

    dialog.showModal()
    dialog.addEventListener('close', handleNativeClose)

    return () => {
      dialog.removeEventListener('close', handleNativeClose)
      // Deliberately NOT calling dialog.close() here. Its native 'close'
      // event dispatches asynchronously (a queued task) — React 18/19
      // StrictMode's dev-only mount -> cleanup -> mount double-invoke means
      // that queued event can still fire *after* the second mount has
      // already attached a fresh listener, incorrectly closing a just-
      // reopened dialog (confirmed by reproducing with timed DOM polling).
      // Removing the <dialog> node — which React does on a real unmount —
      // closes it implicitly without dispatching 'close' at all.
    }
  }, [])

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    // Native <dialog> fills the content box; a click landing on the dialog
    // element itself (not a child) means it hit the ::backdrop area.
    if (event.target === dialogRef.current) onClose()
  }

  return (
    // Backdrop-click-to-dismiss is a convenience layered on top of two fully
    // accessible close paths (Escape, handled natively by <dialog>; the close
    // button below) — not the only way to close, so the a11y linter's concern
    // about mouse-only interaction doesn't apply here.
    // oxlint-disable-next-line click-events-have-key-events no-noninteractive-element-interactions
    <dialog ref={dialogRef} className={styles.panel} aria-labelledby="modal-title" onClick={handleClick}>
      <div className={styles.header}>
        <h2 id="modal-title" className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}
