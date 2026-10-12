import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxeLauncher } from './AxeLauncher'
import { AxeInlineSuggestion } from './AxeInlineSuggestion'
import { SommelierProvider } from './SommelierProvider'
import compassMark from '../../assets/compass-mark.png'

const mockAsk = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  askSommelier: (...args: unknown[]) => mockAsk(...args),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: {
      bottles: [
        { id: 'b1', name: 'E.H. Taylor Single Barrel', status: 'open' },
        { id: 'b2', name: 'Eagle Rare', status: 'sealed' },
      ],
      pours: [],
      memories: [],
      infinityBottles: [{ id: 'inf1', name: 'House Blend', archived: false, createdAt: 0, batches: [] }],
      customLibrary: [],
      people: [],
    },
  }),
}))

function NavButtons() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate('/collection/b2')}>
        go-b2
      </button>
      <button type="button" onClick={() => navigate('/collection')}>
        go-bar
      </button>
    </>
  )
}

function renderAt(path: string, extra?: React.ReactNode) {
  return render(
    <SommelierProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <NavButtons />
                {extra}
                <AxeLauncher />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </SommelierProvider>,
  )
}

const openButton = () => screen.getByRole('button', { name: /Ask AXE, your personal sommelier/ })
const dialog = () => document.querySelector('dialog') as HTMLDialogElement

beforeEach(() => {
  mockAsk.mockReset()
})

describe('AXE — Your Personal Sommelier', () => {
  it('opens from the Ask AXE entry point with the original FIP compass logo and AXE branding', async () => {
    renderAt('/')
    expect(dialog().open).toBe(false)

    await userEvent.click(openButton())

    expect(dialog().open).toBe(true)
    expect(openButton()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('heading', { name: 'AXE' })).toBeInTheDocument()
    expect(screen.getByText('Your Personal Sommelier')).toBeInTheDocument()
    // The entry point and header both use the repository's real logo asset.
    const logos = Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src'))
    expect(logos.filter((src) => src === compassMark).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Where will your palate take you tonight?')).toBeInTheDocument()
  })

  it('closes with the close button and Escape, and keeps the conversation across close/reopen', async () => {
    mockAsk.mockResolvedValue('You have two bourbons open right now.')
    renderAt('/')

    await userEvent.click(openButton())
    await userEvent.type(screen.getByLabelText('Ask AXE anything'), 'What is open?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('You have two bourbons open right now.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close AXE' }))
    expect(dialog().open).toBe(false)

    await userEvent.click(openButton())
    expect(dialog().open).toBe(true)
    expect(screen.getByText('You have two bourbons open right now.')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(dialog().open).toBe(false)
  })

  it('receives the selected bottle context automatically on Bottle Details', async () => {
    mockAsk.mockResolvedValue('A lovely single barrel.')
    renderAt('/collection/b1')

    await userEvent.click(openButton())
    expect(screen.getByText("Let's explore this bottle.")).toBeInTheDocument()
    expect(screen.getByText('E.H. Taylor Single Barrel')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Tell me about this bottle/ }))
    expect(mockAsk).toHaveBeenCalledWith('Tell me about this bottle.', [], { screen: 'bottle', bottleId: 'b1' })
  })

  it('never calls the AI because of ordinary navigation or opening/closing', async () => {
    renderAt('/collection/b1')
    await userEvent.click(screen.getByRole('button', { name: 'go-b2' }))
    await userEvent.click(screen.getByRole('button', { name: 'go-bar' }))
    await userEvent.click(openButton())
    await userEvent.click(screen.getByRole('button', { name: 'Close AXE' }))
    await userEvent.click(screen.getByRole('button', { name: 'go-b2' }))
    expect(mockAsk).not.toHaveBeenCalled()
  })

  it('follows the route — the next question uses the screen the user is on now', async () => {
    mockAsk.mockResolvedValue('ok')
    renderAt('/collection/b1')
    await userEvent.click(screen.getByRole('button', { name: 'go-b2' }))
    await userEvent.click(openButton())
    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /What did I think last time/ }))
    expect(mockAsk).toHaveBeenCalledWith('What did I think last time?', [], { screen: 'bottle', bottleId: 'b2' })
  })

  it('uses a page-supplied context when opened inline, and drops it once the user navigates away', async () => {
    mockAsk.mockResolvedValue('ok')
    renderAt(
      '/',
      <AxeInlineSuggestion
        message="Curious why this one? Ask AXE."
        context={{ screen: 'pour-recommendation', bottleId: 'b2', facts: ['Highly rated'] }}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Curious why this one/ }))
    expect(screen.getByText("AXE's take on tonight's pick.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Why this pour tonight/ }))
    expect(mockAsk).toHaveBeenLastCalledWith('Why is this a good pour for me tonight?', [], {
      screen: 'pour-recommendation',
      bottleId: 'b2',
      facts: ['Highly rated'],
      palate: expect.objectContaining({ pourCount: 0 }),
    })

    await userEvent.click(screen.getByRole('button', { name: 'go-bar' }))
    await userEvent.type(screen.getByLabelText('Ask AXE anything'), 'And now?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(mockAsk).toHaveBeenLastCalledWith('And now?', expect.any(Array), {
      screen: 'collection',
      palate: expect.objectContaining({ pourCount: 0 }),
    })
  })

  it('shows an AXE-branded error when a reply fails', async () => {
    mockAsk.mockRejectedValue(new Error('network down'))
    renderAt('/')
    await userEvent.click(openButton())
    await userEvent.type(screen.getByLabelText('Ask AXE anything'), 'What should I try next?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("AXE couldn't respond just now. Try again in a moment.")
  })

  it('names the Infinity Bottle in the context card on Infinity screens', async () => {
    renderAt('/collection/infinity/inf1')
    await userEvent.click(openButton())
    expect(screen.getByText('House Blend')).toBeInTheDocument()
    expect(screen.getByText("Let's talk about your blend.")).toBeInTheDocument()
  })

  it('sends Your Palate insights on palate screens and leaves them out elsewhere', async () => {
    mockAsk.mockResolvedValue('ok')
    renderAt('/profile')
    await userEvent.click(openButton())
    await userEvent.click(screen.getByRole('button', { name: /What does my palate say about me/ }))
    expect(mockAsk).toHaveBeenLastCalledWith('What does my palate say about me?', [], {
      screen: 'palate',
      palate: {
        pourCount: 0,
        hasBaseline: false,
        qualifyingPourCount: 0,
        maturity: 'learning',
        experiencedFlavors: [],
        preferredFlavors: [],
        patterns: [],
        trends: [],
      },
    })
  })
})
