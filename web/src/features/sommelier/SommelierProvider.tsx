import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { askSommelier, type SommelierTurn } from '../../data/repositories/ai'
import { useUserData } from '../../hooks/useUserData'
import { summarizeCollectionForAi } from './collectionSummary'

interface SommelierState {
  messages: SommelierTurn[]
  sending: boolean
  error: string | null
  send: (prompt: string) => Promise<void>
}

const SommelierContext = createContext<SommelierState>({
  messages: [],
  sending: false,
  error: null,
  send: async () => {},
})

// Mounted once at the app root (see App.tsx) — above the router — so the
// conversation survives switching Journal tabs or navigating to another
// page entirely. Previously this lived in SommelierPanel's own useState,
// which meant it was wiped every time the panel unmounted.
export function SommelierProvider({ children }: { children: ReactNode }) {
  const { userDoc } = useUserData()
  const [messages, setMessages] = useState<SommelierTurn[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim()
      if (!trimmed || sending) return
      setError(null)
      const history = messages
      setMessages([...history, { role: 'user', content: trimmed }])
      setSending(true)
      try {
        const reply = await askSommelier(trimmed, history, summarizeCollectionForAi(userDoc.bottles))
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      } catch {
        setError("The sommelier couldn't respond just now. Try again in a moment.")
      } finally {
        setSending(false)
      }
    },
    [messages, sending, userDoc.bottles],
  )

  const value = useMemo(() => ({ messages, sending, error, send }), [messages, sending, error, send])

  return <SommelierContext.Provider value={value}>{children}</SommelierContext.Provider>
}

export function useSommelier(): SommelierState {
  return useContext(SommelierContext)
}
