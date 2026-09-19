import { Modal } from '../ui/Modal'
import type { Bottle, FillLevel } from '../../data/types'
import type { BottlePatch } from '../../hooks/useUserData'
import styles from './FillLevelModal.module.css'

const FILL_LEVEL_OPTIONS: { value: FillLevel; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'three-quarter', label: 'Three Quarter' },
  { value: 'half', label: 'Half' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'empty', label: 'Empty' },
]

interface FillLevelModalProps {
  bottle: Bottle
  onUpdate: (bottleId: string, patch: BottlePatch) => Promise<void>
  onClose: () => void
}

// A one-tap fill-level picker, same pattern as ChangeBottleStatusModal —
// only ever offered for a single-instance open bottle (see BottleCard/
// BottleListRow), since fill level is ambiguous once there's more than one
// physical bottle and only meaningful once opened.
export function FillLevelModal({ bottle, onUpdate, onClose }: FillLevelModalProps) {
  async function handleSelect(fillLevel: FillLevel) {
    if (fillLevel === bottle.fillLevel) return
    await onUpdate(bottle.id, { fillLevel })
    onClose()
  }

  return (
    <Modal title="Update Fill Level" onClose={onClose}>
      <div className={styles.list}>
        {FILL_LEVEL_OPTIONS.map((option) => {
          const isCurrent = option.value === bottle.fillLevel
          return (
            <button
              key={option.value}
              type="button"
              className={isCurrent ? `${styles.option} ${styles.optionCurrent}` : styles.option}
              onClick={() => void handleSelect(option.value)}
              disabled={isCurrent}
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
