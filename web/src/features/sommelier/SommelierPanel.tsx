import { useEffect, useRef, useState, type FormEvent } from 'react'
import { controlClassName } from '../../components/ui/Field'
import { useUserData } from '../../hooks/useUserData'
import { copyForContext, type AxeContext } from './axeContext'
import { useSommelier } from './SommelierProvider'
import styles from './SommelierPanel.module.css'

// What the Current Context card names — resolved locally for display only
// (the server re-reads the real record itself, see functions/axeContext.js).
function useContextLabel(context: AxeContext): string {
  const { userDoc } = useUserData()
  const copy = copyForContext(context)
  if (context.bottleId) {
    const bottle = userDoc.bottles.find((b) => b.id === context.bottleId)
    if (bottle) return bottle.name
  }
  if (context.infinityBottleId) {
    const vessel = userDoc.infinityBottles.find((v) => v.id === context.infinityBottleId)
    if (vessel) return vessel.name
  }
  if (context.friendUsername) return `@${context.friendUsername}`
  return copy.label
}

// AXE's conversation body — intro, current context, suggested questions,
// the conversation itself, and a free-form input. Lives inside AxeSheet;
// all conversation state is in SommelierProvider so it survives close/reopen.
export function SommelierPanel() {
  const { messages, sending, error, send, reset, context } = useSommelier()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const copy = copyForContext(context)
  const contextLabel = useContextLabel(context)

  useEffect(() => {
    const el = scrollRef.current
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight })
  }, [messages.length, sending])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const prompt = input
    if (!prompt.trim() || sending) return
    setInput('')
    void send(prompt)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.scroll} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.intro}>
            <h3 className={styles.title}>{copy.title}</h3>
            <p className={styles.introText}>{copy.intro}</p>
          </div>
        ) : null}

        <div className={styles.contextCard}>
          <span className={styles.contextEyebrow}>Current context</span>
          <span className={styles.contextLabel}>{contextLabel}</span>
        </div>

        {messages.length === 0 ? (
          <div className={styles.starters} role="group" aria-label="Suggested questions">
            {copy.suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                className={styles.starter}
                onClick={() => void send(suggestion.prompt)}
                disabled={sending}
              >
                <span>{suggestion.label}</span>
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.messages} role="log" aria-live="polite" aria-label="Conversation with AXE">
            {messages.map((message, index) => (
              <div key={index} className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                {message.role === 'assistant' ? <span className={styles.srOnly}>AXE: </span> : null}
                {message.content}
              </div>
            ))}
            {sending ? <div className={styles.assistantMessage}>AXE is thinking…</div> : null}
          </div>
        )}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {messages.length > 0 && !sending ? (
          <button type="button" className={styles.reset} onClick={reset}>
            Start a new conversation
          </button>
        ) : null}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          data-axe-input
          className={`${controlClassName} ${styles.input}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AXE anything…"
          aria-label="Ask AXE anything"
          enterKeyHint="send"
          maxLength={2000}
        />
        <button type="submit" className={styles.send} disabled={sending || !input.trim()} aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  )
}
