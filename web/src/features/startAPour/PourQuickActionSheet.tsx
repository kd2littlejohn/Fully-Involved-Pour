import { Modal } from '../../components/ui/Modal'
import styles from './PourQuickActionSheet.module.css'

export type PourQuickAction = 'record' | 'blind' | 'add-bottle' | 'update-open' | 'infinity'

interface ActionOption {
  action: PourQuickAction
  title: string
  description: string
  // When false, this option is left out entirely rather than shown
  // disabled — each one only appears when the user can actually do it.
  available: boolean
}

interface PourQuickActionSheetProps {
  canRecordPour: boolean
  canUpdateOpenBottle: boolean
  canAddToInfinityBottle: boolean
  onPick: (action: PourQuickAction) => void
  onClose: () => void
}

// The bottom/top nav's "Pour" button opens this — every quick action
// reachable without already being on a bottle-specific screen. Each item
// routes into whichever existing feature already owns it (see
// usePourQuickActions.tsx); this component is just the menu.
export function PourQuickActionSheet({ canRecordPour, canUpdateOpenBottle, canAddToInfinityBottle, onPick, onClose }: PourQuickActionSheetProps) {
  const options: ActionOption[] = [
    { action: 'record', title: 'Record a Pour', description: 'Capture what you’re drinking right now.', available: canRecordPour },
    { action: 'blind', title: 'Start a Blind Tasting', description: 'Remove the label and discover what you actually prefer.', available: true },
    { action: 'add-bottle', title: 'Add a Bottle', description: 'Grow your collection.', available: true },
    { action: 'update-open', title: 'Update an Open Bottle', description: 'Adjust fill level or status.', available: canUpdateOpenBottle },
    { action: 'infinity', title: 'Add to an Infinity Bottle', description: 'Log an addition to a blend in progress.', available: canAddToInfinityBottle },
  ]

  const visible = options.filter((o) => o.available)

  return (
    <Modal title="Pour" onClose={onClose}>
      <div className={styles.options}>
        {visible.map((option) => (
          <button key={option.action} type="button" className={styles.option} onClick={() => onPick(option.action)}>
            <span className={styles.optionTitle}>{option.title}</span>
            <span className={styles.optionDescription}>{option.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
