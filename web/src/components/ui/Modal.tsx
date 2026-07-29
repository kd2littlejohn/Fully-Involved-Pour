import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
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
    <dialog ref={dialogRef} className={styles.panel} aria-labelledby="modal-title" onClose={onClose} onClick={handleClick}>
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
