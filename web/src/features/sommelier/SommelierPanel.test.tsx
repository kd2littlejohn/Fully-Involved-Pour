import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SommelierPanel } from './SommelierPanel'

const mockAsk = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  askSommelier: (...args: unknown[]) => mockAsk(...args),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: [{ id: 'b1', name: 'Eagle Rare', status: 'open' }] } }),
}))

beforeEach(() => {
  mockAsk.mockReset()
})

describe('SommelierPanel', () => {
  it('sends a starter prompt and shows the reply', async () => {
    mockAsk.mockResolvedValue('Try something with more oak next.')
    render(<SommelierPanel />)

    await userEvent.click(screen.getByRole('button', { name: "What's the vibe tonight?" }))

    expect(mockAsk).toHaveBeenCalledWith("What's the vibe tonight?", [], expect.stringContaining('Eagle Rare'))
    expect(await screen.findByText('Try something with more oak next.')).toBeInTheDocument()
  })

  it('sends a typed message and shows an error on failure', async () => {
    mockAsk.mockRejectedValue(new Error('network down'))
    render(<SommelierPanel />)

    await userEvent.type(screen.getByLabelText('Ask your pour assistant'), 'What should I try next?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText("The sommelier couldn't respond just now. Try again in a moment.")).toBeInTheDocument()
  })
})
