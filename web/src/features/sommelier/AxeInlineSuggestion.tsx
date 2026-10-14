import type { AxeContext } from './axeContext'
import { useSommelier } from './SommelierProvider'
import { AxeSymbol } from './AxeMark'
import styles from './AxeInlineSuggestion.module.css'

interface AxeInlineSuggestionProps {
  message: string
  /** The context AXE should open with — read at click time, never sent until the user asks something. */
  context: AxeContext | (() => AxeContext)
}

// Inline AXE entry point inside an existing workflow (a tasting form, a
// recommendation card). Opening AXE never touches the surrounding form —
// it only passes a read-only snapshot of context along.
export function AxeInlineSuggestion({ message, context }: AxeInlineSuggestionProps) {
  const { openAxe } = useSommelier()
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => openAxe(typeof context === 'function' ? context() : context)}
      aria-haspopup="dialog"
    >
      <AxeSymbol size={30} className={styles.mark} />
      <span className={styles.text}>
        <span className={styles.brand}>AXE</span>
        <span className={styles.message}>{message}</span>
      </span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </button>
  )
}
