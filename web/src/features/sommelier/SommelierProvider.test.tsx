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
  useUserData: () => ({ userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] } }),
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
})
