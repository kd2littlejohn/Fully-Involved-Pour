import { useState } from 'react'
import { AxeSymbol } from '../sommelier/AxeMark'
import { askPartyAxe, partyErrorMessage, type PartyAxeQuestion } from '../../data/repositories/party'
import styles from './party.module.css'

const QUESTIONS: { id: PartyAxeQuestion; label: string }[] = [
  { id: 'room-preference', label: 'Why did the room pick the winner?' },
  { id: 'my-palate', label: 'What do my scores say about my palate?' },
  { id: 'style-differences', label: 'How were these whiskeys different?' },
  { id: 'try-next', label: 'What should I try next?' },
]

// AXE after a reveal — optional, tucked below the results, one tap per
// question. Uses only the round's published results and the guest's own
// ballot (see functions/party/axe.js). The party never depends on it.
export function PartyAxeCard({ partyId, categoryId }: { partyId: string; categoryId: string }) {
  const [asking, setAsking] = useState<PartyAxeQuestion | null>(null)
  const [answer, setAnswer] = useState<{ question: string; reply: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(question: (typeof QUESTIONS)[number]) {
    setAsking(question.id)
    setError(null)
    try {
      const reply = await askPartyAxe(partyId, categoryId, question.id)
      setAnswer({ question: question.label, reply })
    } catch (err) {
      setError(partyErrorMessage(err))
    } finally {
      setAsking(null)
    }
  }

  return (
    <details className={styles.card}>
      <summary className={styles.row} style={{ cursor: 'pointer', minHeight: 44 }}>
        <AxeSymbol size={28} />
        <span className={styles.label}>Ask AXE, your personal sommelier</span>
      </summary>
      <div className={styles.row}>
        {QUESTIONS.map((q) => (
          <button key={q.id} type="button" className={styles.choice} style={{ width: 'auto' }} disabled={asking !== null} onClick={() => ask(q)}>
            {asking === q.id ? 'AXE is thinking…' : q.label}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {answer ? (
          <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
            <span className={styles.muted}>{answer.question}</span>
            <p className={styles.subtitle}>{answer.reply}</p>
          </div>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    </details>
  )
}
