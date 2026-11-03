import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { AxeSymbol } from '../sommelier/AxeMark'
import { askTastingAxe, partyErrorMessage, type TastingAxeTurn } from '../../data/repositories/party'
import type { PartyGroup } from './types'
import styles from './party.module.css'

const GUIDED_PROMPTS = [
  'What’s the mash bill of this one?',
  'How was it distilled and aged?',
  'What flavors should I look for?',
  'How does it compare with the other glasses?',
]

const BLIND_PROMPTS = [
  'What aromas should I look for?',
  'How do I judge the finish?',
  'Help me describe what I’m tasting.',
  'How should I compare these glasses?',
]

// AXE beside the glass during a live tasting. The suggested questions follow
// the taster's experience, but what AXE actually knows is decided on the
// server from their own guest record (functions/party/tastingAxe.js): a
// blind taster's AXE has no bottle facts at all, whatever is typed here.
export function TastingAxePanel({
  partyId,
  categoryId,
  label,
  experience,
}: {
  partyId: string
  categoryId: string
  label: string | null
  experience: PartyGroup | 'regular'
}) {
  const [history, setHistory] = useState<TastingAxeTurn[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blind = experience === 'blind'
  const prompts = blind ? BLIND_PROMPTS : GUIDED_PROMPTS

  async function ask(text: string) {
    const prompt = text.trim()
    if (!prompt || asking) return
    setAsking(true)
    setError(null)
    try {
      const { reply } = await askTastingAxe({ partyId, categoryId, label, prompt, history: history.slice(-8) })
      setHistory((h) => [...h, { role: 'user' as const, content: prompt }, { role: 'assistant' as const, content: reply }].slice(-12))
      setQuestion('')
    } catch (err) {
      setError(partyErrorMessage(err))
    } finally {
      setAsking(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void ask(question)
  }

  return (
    <details className={styles.card} data-testid="tasting-axe">
      <summary className={styles.row} style={{ cursor: 'pointer', minHeight: 44 }}>
        <AxeSymbol size={28} />
        <span className={styles.label}>{label ? `Ask AXE about glass ${label}` : 'Ask AXE'}</span>
      </summary>
      <p className={styles.muted}>
        {blind
          ? 'AXE helps you taste and describe — it doesn’t know what’s in the glass either, so the reveal stays a surprise.'
          : 'AXE knows this flight’s bottles: ask about mash bills, distilling, barrels, flavors or how the glasses compare.'}
      </p>
      <div className={styles.row}>
        {prompts.map((p) => (
          <button key={p} type="button" className={styles.choice} style={{ width: 'auto' }} disabled={asking} onClick={() => void ask(p)}>
            {p}
          </button>
        ))}
      </div>
      <div aria-live="polite" className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
        {history.map((turn, i) =>
          turn.role === 'user' ? (
            <span key={i} className={styles.muted}>
              You: {turn.content}
            </span>
          ) : (
            <p key={i} className={styles.subtitle}>
              {turn.content}
            </p>
          ),
        )}
        {asking ? <span className={styles.muted}>AXE is thinking…</span> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
      <form onSubmit={submit} className={styles.row}>
        <label className={styles.srOnly} htmlFor={`axe-q-${categoryId}`}>
          Your question for AXE
        </label>
        <input
          id={`axe-q-${categoryId}`}
          className={`${styles.input} ${styles.grow}`}
          maxLength={600}
          value={question}
          placeholder={blind ? 'Ask about aromas, flavors, finish…' : 'Ask about this bottle…'}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={asking || !question.trim()}>
          Ask
        </Button>
      </form>
    </details>
  )
}
