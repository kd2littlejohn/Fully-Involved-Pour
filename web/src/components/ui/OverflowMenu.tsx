import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './OverflowMenu.module.css'

export interface OverflowMenuItem {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

// Room kept clear for fixed chrome at the bottom of the screen (the mobile
// bottom nav plus the iPhone home indicator).
const BOTTOM_CHROME_PX = 96

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
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Open upward when the menu would otherwise run under the bottom nav
  // (e.g. a card low on an iPhone screen) and there's more room above.
  useLayoutEffect(() => {
    if (!open) {
      setDropUp(false)
      return
    }
    const root = rootRef.current
    const panel = panelRef.current
    if (!root || !panel) return
    const trigger = root.getBoundingClientRect()
    const needed = panel.offsetHeight + 8
    const below = window.innerHeight - trigger.bottom - BOTTOM_CHROME_PX
    const above = trigger.top
    setDropUp(needed > below && above > below)
  }, [open])

  useEffect(() => {
    if (!open) return

    // pointerdown, not mousedown: iOS Safari doesn't send mouse events for
    // taps on non-interactive areas, so an outside tap would never close it.
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
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
        <div ref={panelRef} className={dropUp ? `${styles.panel} ${styles.panelUp}` : styles.panel} role="menu">
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
