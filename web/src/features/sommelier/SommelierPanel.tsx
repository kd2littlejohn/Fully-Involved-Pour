import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { controlClassName } from '../../components/ui/Field'
import { useUserData } from '../../hooks/useUserData'
import { askSommelier, type SommelierTurn } from '../../data/repositories/ai'
import { summarizeCollectionForAi } from './collectionSummary'
import styles from './SommelierPanel.module.css'

const STARTER_PROMPTS = [
  "What's the vibe tonight?",
  'What should I try next based on my collection?',
  'What bottle should I buy next?',
  "Help me write tasting notes for what I'm sipping.",
]

export function SommelierPanel() {
  const { userDoc } = useUserData()
  const [messages, setMessages] = useState<SommelierTurn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(prompt: string) {
    const trimmed = prompt.trim()
    if (!trimmed || sending) return
    setError(null)
    const history = messages
    setMessages([...history, { role: 'user', content: trimmed }])
    setInput('')
    setSending(true)
    try {
      const reply = await askSommelier(trimmed, history, summarizeCollectionForAi(userDoc.bottles))
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setError("The sommelier couldn't respond just now. Try again in a moment.")
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void send(input)
  }

  return (
    <div className={styles.panel}>
      {messages.length === 0 ? (
        <div className={styles.starters}>
          {STARTER_PROMPTS.map((prompt) => (
            <button key={prompt} type="button" className={styles.starter} onClick={() => void send(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.messages} aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
              {message.content}
            </div>
          ))}
          {sending ? <div className={styles.assistantMessage}>Thinking…</div> : null}
        </div>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={controlClassName}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your pour assistant…"
          disabled={sending}
          aria-label="Ask your pour assistant"
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}
