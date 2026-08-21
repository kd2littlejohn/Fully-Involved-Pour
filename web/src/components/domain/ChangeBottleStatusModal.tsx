import { useState } from 'react'
import { Modal } from '../ui/Modal'
import type { Bottle, BottleStatus } from '../../data/types'
import type { BottlePatch } from '../../hooks/useUserData'
import styles from './ChangeBottleStatusModal.module.css'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_OPTIONS: { value: BottleStatus; label: string }[] = [
  { value: 'wishlist', label: 'Wish List' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'sealed', label: 'Sealed' },
  { value: 'open', label: 'Opened' },
  { value: 'finished', label: 'Finished' },
]

interface ChangeBottleStatusModalProps {
  bottle: Bottle
  onUpdate: (bottleId: string, patch: BottlePatch) => Promise<void>
  onClose: () => void
  // Fired after a successful change, alongside onClose — e.g. Bottle
  // Details uses this to trigger its own "Bottle Kill" celebration when
  // the new status is 'finished', same as its old dedicated shortcut did.
  // Left unused by My Bar's grid/list cards, which never had that
  // celebration wired to their own shortcut either.
  onStatusChanged?: (status: BottleStatus) => void
}

// One tap, no edit form — shared by every place a bottle's status shows
// (My Bar grid/list, Bottle Details). Replaces the two hardcoded "Mark as
// Opened" / "Mark as Finished" shortcuts that used to live in each of
// those menus with the full set, so any transition (including e.g.
// Wishlist → Sealed once you actually buy it) is just as fast as the two
// that already had shortcuts.
export function ChangeBottleStatusModal({ bottle, onUpdate, onClose, onStatusChanged }: ChangeBottleStatusModalProps) {
  const [changingTo, setChangingTo] = useState<BottleStatus | null>(null)

  async function handleSelect(status: BottleStatus) {
    if (status === bottle.status || changingTo) return
    setChangingTo(status)
    try {
      const patch: BottlePatch = { status }
      // Same "default to today, never overwrite a date already entered"
      // rule the full edit form's status field already follows.
      if (status === 'open') patch.openedDate = bottle.openedDate ?? todayIsoDate()
      if (status === 'finished') patch.finishedDate = bottle.finishedDate ?? todayIsoDate()
      await onUpdate(bottle.id, patch)
      onStatusChanged?.(status)
      onClose()
    } finally {
      setChangingTo(null)
    }
  }

  return (
    <Modal title="Change Status" onClose={onClose}>
      <div className={styles.list}>
        {STATUS_OPTIONS.map((option) => {
          const isCurrent = option.value === bottle.status
          return (
            <button
              key={option.value}
              type="button"
              className={isCurrent ? `${styles.option} ${styles.optionCurrent}` : styles.option}
              onClick={() => void handleSelect(option.value)}
              disabled={isCurrent || changingTo !== null}
            >
              {option.label}
              {isCurrent ? <span className={styles.currentTag}>Current</span> : null}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
