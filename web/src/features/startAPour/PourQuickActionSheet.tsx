import type { ReactNode } from 'react'
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
            <span className={styles.optionIcon} aria-hidden="true">
              {ICONS[option.action]}
            </span>
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>{option.title}</span>
              <span className={styles.optionDescription}>{option.description}</span>
            </span>
            <span className={styles.optionChevron} aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

const ICON_PROPS = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const ICONS: Record<PourQuickAction, ReactNode> = {
  record: (
    <svg {...ICON_PROPS}>
      <path d="M8 3h8M9 3v3.5c0 1.2-3 3-3 7.5a6 6 0 0 0 12 0c0-4.5-3-6.3-3-7.5V3" />
      <path d="M6.3 14h11.4" />
    </svg>
  ),
  blind: (
    <svg {...ICON_PROPS}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  'add-bottle': (
    <svg {...ICON_PROPS}>
      <path d="M10 2h4v4l1.5 2.5V21a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V8.5L10 6V2z" />
      <path d="M12 12v5M9.5 14.5h5" />
    </svg>
  ),
  'update-open': (
    <svg {...ICON_PROPS}>
      <rect x="4" y="6" width="16" height="13" rx="3" />
      <path d="M4 10h16M9 6v13M15 6v13" />
    </svg>
  ),
  infinity: (
    <svg {...ICON_PROPS}>
      <path d="M12 12c-2-2.7-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.5-1.3 5.5-4Zm0 0c2 2.7 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.5 1.3-5.5 4Z" />
    </svg>
  ),
}
