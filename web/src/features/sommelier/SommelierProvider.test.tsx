import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SommelierProvider, useSommelier } from './SommelierProvider'

const mockUseAuth = vi.fn()
const mockAskSommelier = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } }),
}))

vi.mock('../../data/repositories/ai', () => ({
  askSommelier: (...args: unknown[]) => mockAskSommelier(...args),
}))

function Consumer() {
  const { messages, send } = useSommelier()
  return (
    <div>
      <ul>
        {messages.map((m, i) => (
          <li key={i}>
            {m.role}: {m.content}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void send('hello')}>
        Ask
      </button>
    </div>
  )
}

describe('SommelierProvider', () => {
  it('clears the conversation when the signed-in uid changes, so one account never sees another’s chat', async () => {
    mockAskSommelier.mockResolvedValue('Try something oaky.')
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } })

    const { rerender } = render(
      <SommelierProvider>
        <Consumer />
      </SommelierProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('assistant: Try something oaky.')).toBeInTheDocument()

    mockUseAuth.mockReturnValue({ user: { uid: 'user-2' } })
    await act(async () => {
      rerender(
        <SommelierProvider>
          <Consumer />
        </SommelierProvider>,
      )
    })

    expect(screen.queryByText(/Try something oaky/)).not.toBeInTheDocument()
    expect(screen.queryByText(/user: hello/)).not.toBeInTheDocument()
  })

  it('clears the conversation on sign-out too', async () => {
    mockAskSommelier.mockResolvedValue('Try something oaky.')
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } })

    const { rerender } = render(
      <SommelierProvider>
        <Consumer />
      </SommelierProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('assistant: Try something oaky.')).toBeInTheDocument()

    mockUseAuth.mockReturnValue({ user: null })
    await act(async () => {
      rerender(
        <SommelierProvider>
          <Consumer />
        </SommelierProvider>,
      )
    })

    expect(screen.queryByText(/Try something oaky/)).not.toBeInTheDocument()
  })

  it('asks about an AXE Insight through the existing chat, sending only its id', async () => {
    mockAskSommelier.mockReset().mockResolvedValue('Because your Rye pours average 9.0.')
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } })
    function InsightConsumer() {
      const { askAboutInsight, send, messages, isOpen, context } = useSommelier()
      return (
        <div>
          <button type="button" onClick={() => askAboutInsight('palate-evolution:style-preference:rye', 'Why do you think that?')}>
            Ask about insight
          </button>
          <button type="button" onClick={() => void send('And what else?')}>
            Follow up
          </button>
          <p>open: {String(isOpen)}</p>
          <p>insight: {context.insightId ?? 'none'}</p>
          <p>count: {messages.length}</p>
        </div>
      )
    }
    render(
      <SommelierProvider>
        <InsightConsumer />
      </SommelierProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Ask about insight' }))
    expect(await screen.findByText('count: 2')).toBeInTheDocument()
    expect(screen.getByText('open: true')).toBeInTheDocument()
    expect(mockAskSommelier).toHaveBeenLastCalledWith('Why do you think that?', [], expect.objectContaining({ insightId: 'palate-evolution:style-preference:rye' }))
    // The insight's facts never travel from the client: only the id.
    expect(Object.keys(mockAskSommelier.mock.calls[0]![2])).not.toContain('facts')

    // Follow-ups keep the same insight context.
    await userEvent.click(screen.getByRole('button', { name: 'Follow up' }))
    expect(await screen.findByText('count: 4')).toBeInTheDocument()
    expect(mockAskSommelier).toHaveBeenLastCalledWith('And what else?', expect.any(Array), expect.objectContaining({ insightId: 'palate-evolution:style-preference:rye' }))
  })

  it('ask() opens AXE and sends a free-form question from the route context, never a stale insight context', async () => {
    mockAskSommelier.mockReset().mockResolvedValue('Try the Rye.')
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } })
    function AskConsumer() {
      const { ask, askAboutInsight, setRouteContext, isOpen, messages, error } = useSommelier()
      return (
        <div>
          <button type="button" onClick={() => setRouteContext({ screen: 'home' })}>
            Route
          </button>
          <button type="button" onClick={() => askAboutInsight('i1')}>
            Insight
          </button>
          <button type="button" onClick={() => ask('What should I open?')}>
            Ask anything
          </button>
          <p>open: {String(isOpen)}</p>
          <p>count: {messages.length}</p>
          <p>error: {error ?? 'none'}</p>
        </div>
      )
    }
    render(
      <SommelierProvider>
        <AskConsumer />
      </SommelierProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Route' }))
    await userEvent.click(screen.getByRole('button', { name: 'Insight' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ask anything' }))
    expect(await screen.findByText('count: 2')).toBeInTheDocument()
    expect(screen.getByText('open: true')).toBeInTheDocument()
    expect(mockAskSommelier).toHaveBeenLastCalledWith('What should I open?', [], { screen: 'home', palate: expect.anything() })
  })

  it('ask() surfaces a friendly error when AXE is unavailable', async () => {
    mockAskSommelier.mockReset().mockRejectedValue(new Error('unavailable'))
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } })
    function AskConsumer() {
      const { ask, error } = useSommelier()
      return (
        <div>
          <button type="button" onClick={() => ask('Hello?')}>
            Ask anything
          </button>
          <p>error: {error ?? 'none'}</p>
        </div>
      )
    }
    render(
      <SommelierProvider>
        <AskConsumer />
      </SommelierProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Ask anything' }))
    expect(await screen.findByText(/^error: AXE couldn't respond just now/)).toBeInTheDocument()
  })
})
