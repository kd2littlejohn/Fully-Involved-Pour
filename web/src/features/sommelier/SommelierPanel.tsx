import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { controlClassName } from '../../components/ui/Field'
import { useSommelier } from './SommelierProvider'
import styles from './SommelierPanel.module.css'

const STARTER_PROMPTS = [
  "What's the vibe tonight?",
  'What should I try next based on my collection?',
  'What bottle should I buy next?',
  "Help me write tasting notes for what I'm sipping.",
]

export function SommelierPanel() {
  const { messages, sending, error, send } = useSommelier()
  const [input, setInput] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const prompt = input
    setInput('')
    void send(prompt)
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
