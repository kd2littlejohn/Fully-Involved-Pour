import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SommelierPanel } from './SommelierPanel'
import { SommelierProvider } from './SommelierProvider'

const mockAsk = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  askSommelier: (...args: unknown[]) => mockAsk(...args),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles: [{ id: 'b1', name: 'Eagle Rare', status: 'open' }] } }),
}))

function renderPanel() {
  return render(
    <SommelierProvider>
      <SommelierPanel />
    </SommelierProvider>,
  )
}

beforeEach(() => {
  mockAsk.mockReset()
})

describe('SommelierPanel', () => {
  it('sends a starter prompt and shows the reply', async () => {
    mockAsk.mockResolvedValue('Try something with more oak next.')
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: "What's the vibe tonight?" }))

    expect(mockAsk).toHaveBeenCalledWith("What's the vibe tonight?", [], expect.stringContaining('Eagle Rare'))
    expect(await screen.findByText('Try something with more oak next.')).toBeInTheDocument()
  })

  it('sends a typed message and shows an error on failure', async () => {
    mockAsk.mockRejectedValue(new Error('network down'))
    renderPanel()

    await userEvent.type(screen.getByLabelText('Ask your pour assistant'), 'What should I try next?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText("The sommelier couldn't respond just now. Try again in a moment.")).toBeInTheDocument()
  })

  it('keeps the conversation when the panel unmounts and remounts under the same provider (e.g. switching Journal tabs)', async () => {
    mockAsk.mockResolvedValue('Try something with more oak next.')

    // Mirrors how JournalPage renders SommelierPanel: SommelierProvider sits
    // above the tab switch (mounted once in App.tsx), so the panel itself
    // unmounts/remounts on every tab change while the provider survives.
    function TogglingHost() {
      const [showPanel, setShowPanel] = useState(true)
      return (
        <SommelierProvider>
          <button type="button" onClick={() => setShowPanel((v) => !v)}>
            toggle-tab
          </button>
          {showPanel ? <SommelierPanel /> : null}
        </SommelierProvider>
      )
    }

    render(<TogglingHost />)

    await userEvent.click(screen.getByRole('button', { name: "What's the vibe tonight?" }))
    expect(await screen.findByText('Try something with more oak next.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'toggle-tab' })) // unmount the panel
    await userEvent.click(screen.getByRole('button', { name: 'toggle-tab' })) // remount it

    expect(screen.getByText('Try something with more oak next.')).toBeInTheDocument()
  })
})
