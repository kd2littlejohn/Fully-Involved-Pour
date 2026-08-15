import { Modal } from '../../components/ui/Modal'
import styles from './PourTypeModal.module.css'

export type PourType = 'quick' | 'story' | 'blind' | 'compare'

interface PourTypeOption {
  type: PourType
  title: string
  description: string
}

const OPTIONS: PourTypeOption[] = [
  { type: 'quick', title: 'Quick Pour', description: 'Capture the moment in seconds — reaction, score, done.' },
  { type: 'story', title: 'Pour Story', description: 'The full tasting breakdown — nose, palate, finish, and more.' },
  { type: 'blind', title: 'Blind Room', description: 'Hide the label — solo or with friends — and find out what you actually prefer.' },
  { type: 'compare', title: 'Comparison', description: 'Pour two bottles side-by-side.' },
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
