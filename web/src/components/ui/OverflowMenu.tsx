import { useEffect, useRef, useState } from 'react'
import styles from './OverflowMenu.module.css'

export interface OverflowMenuItem {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

interface OverflowMenuProps {
  items: OverflowMenuItem[]
  label?: string
}

// A small "more actions" popover — closes on outside click, Escape, or
// picking an item. No existing dropdown primitive in the design system yet;
// this is the first, kept generic so it's reusable wherever admin-y actions
// need to move out of the primary action row (Bottle Details now, My Bar
// bottle cards later).
export function OverflowMenu({ items, label = 'More actions' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function handleItemClick(item: OverflowMenuItem) {
    setOpen(false)
    item.onClick()
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open ? (
        <div className={styles.panel} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.tone === 'danger' ? `${styles.item} ${styles.itemDanger}` : styles.item}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
