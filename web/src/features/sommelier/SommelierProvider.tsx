import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { askSommelier, type SommelierTurn } from '../../data/repositories/ai'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { buildAxePalateInsights, PALATE_SCREENS } from './axePalate'
import { contextKey, type AxeContext } from './axeContext'
import { AxeSheet } from './AxeSheet'

interface SommelierState {
  messages: SommelierTurn[]
  sending: boolean
  error: string | null
  send: (prompt: string) => Promise<void>
  /** Clears the conversation (an explicit "start over"). */
  reset: () => void
  isOpen: boolean
  /** The context AXE will answer from right now — route context unless a page supplied a more specific one. */
  context: AxeContext
  /**
   * Opens AXE. Pass an override when the opener knows more than the URL
   * (the current What Should I Pour pick, an in-progress tasting form).
   */
  openAxe: (override?: AxeContext) => void
  /**
   * Opens AXE about one AXE Insight: AXE answers from that insight's
   * verified facts (looked up server-side by id). Sends `prompt` if given.
   */
  askAboutInsight: (insightId: string, prompt?: string) => void
  closeAxe: () => void
  /** Reported by AxeRouteContext as the route changes. Pure state — never sends anything. */
  setRouteContext: (context: AxeContext) => void
}

const DEFAULT_CONTEXT: AxeContext = { screen: 'general' }

const SommelierContext = createContext<SommelierState>({
  messages: [],
  sending: false,
  error: null,
  send: async () => {},
  reset: () => {},
  isOpen: false,
  context: DEFAULT_CONTEXT,
  openAxe: () => {},
  askAboutInsight: () => {},
  closeAxe: () => {},
  setRouteContext: () => {},
})

// Mounted once at the app root (see App.tsx) — above the router — so the
// conversation survives closing/reopening AXE, switching tabs, or
// navigating to another page entirely. AXE's sheet/drawer is rendered here
// too, so any screen (including full-screen flows and modals like the Pour
// Story wizard) can open it without remounting what's underneath.
export function SommelierProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { userDoc } = useUserData()
  const [messages, setMessages] = useState<SommelierTurn[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [routeContext, setRouteContextState] = useState<AxeContext>(DEFAULT_CONTEXT)
  const [override, setOverride] = useState<AxeContext | null>(null)
  const routeKeyRef = useRef(contextKey(DEFAULT_CONTEXT))

  // The conversation is generated from (and can reference specifics of) this
  // user's own collection — it must never survive a sign-out or a same-tab
  // switch to a different account. Sign-out is a client-side navigation, not
  // a full reload, so nothing else clears this automatically.
  useEffect(() => {
    setMessages([])
    setError(null)
    setOverride(null)
    setIsOpen(false)
  }, [user?.uid])

  const setRouteContext = useCallback((next: AxeContext) => {
    const key = contextKey(next)
    if (key === routeKeyRef.current) return
    routeKeyRef.current = key
    setRouteContextState(next)
    // A page-supplied override describes the screen it was opened from —
    // stale once the user has moved somewhere else.
    setOverride(null)
  }, [])

  const context = override ?? routeContext

  const sendWith = useCallback(
    async (prompt: string, activeContext: AxeContext) => {
      const trimmed = prompt.trim()
      if (!trimmed || sending) return
      setError(null)
      const history = messages
      setMessages([...history, { role: 'user', content: trimmed }])
      setSending(true)
      try {
        const requestContext = PALATE_SCREENS.has(activeContext.screen)
          ? { ...activeContext, palate: buildAxePalateInsights(userDoc.bottles, userDoc.pours) }
          : activeContext
        const reply = await askSommelier(trimmed, history, requestContext)
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      } catch {
        setError("AXE couldn't respond just now. Try again in a moment.")
      } finally {
        setSending(false)
      }
    },
    [messages, sending, userDoc.bottles, userDoc.pours],
  )

  const send = useCallback((prompt: string) => sendWith(prompt, context), [sendWith, context])

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const openAxe = useCallback((next?: AxeContext) => {
    setOverride(next ?? null)
    setIsOpen(true)
  }, [])

  const askAboutInsight = useCallback(
    (insightId: string, prompt?: string) => {
      const insightContext: AxeContext = { ...routeContext, insightId }
      setOverride(insightContext)
      setIsOpen(true)
      if (prompt) void sendWith(prompt, insightContext)
    },
    [routeContext, sendWith],
  )

  const closeAxe = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ messages, sending, error, send, reset, isOpen, context, openAxe, askAboutInsight, closeAxe, setRouteContext }),
    [messages, sending, error, send, reset, isOpen, context, openAxe, askAboutInsight, closeAxe, setRouteContext],
  )

  return (
    <SommelierContext.Provider value={value}>
      {children}
      {user ? <AxeSheet /> : null}
    </SommelierContext.Provider>
  )
}

export function useSommelier(): SommelierState {
  return useContext(SommelierContext)
}
