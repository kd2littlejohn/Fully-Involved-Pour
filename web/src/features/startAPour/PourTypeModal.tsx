import { Modal } from '../../components/ui/Modal'
import styles from './PourTypeModal.module.css'

export type PourType = 'quick' | 'story' | 'blind' | 'compare'

interface PourTypeOption {
  type: PourType
  title: string
  description: string
}

const OPTIONS: PourTypeOption[] = [
  { type: 'quick', title: 'Quick Pour', description: 'Capture what you’re drinking in seconds.' },
  { type: 'story', title: 'Pour Story', description: 'Take your time and capture the full experience.' },
  { type: 'blind', title: 'Blind Room', description: 'Remove the label and discover what you actually prefer.' },
  { type: 'compare', title: 'Compare', description: 'Taste bottles side by side.' },
]

interface PourTypeModalProps {
  bottleName?: string
  onPick: (type: PourType) => void
  onClose: () => void
}

export function PourTypeModal({ bottleName, onPick, onClose }: PourTypeModalProps) {
  return (
    <Modal title={bottleName ? `Pouring ${bottleName}` : 'Start a Pour'} onClose={onClose}>
      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <button key={option.type} type="button" className={styles.option} onClick={() => onPick(option.type)}>
            <span className={styles.optionTitle}>{option.title}</span>
            <span className={styles.optionDescription}>{option.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
