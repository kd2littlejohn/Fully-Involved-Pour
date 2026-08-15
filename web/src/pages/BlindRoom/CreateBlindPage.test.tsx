import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateBlindPage } from './CreateBlindPage'
import type { Bottle } from '../../data/types'

const mockUseAuth = vi.fn()
const mockNavigate = vi.fn()
const mockCreateBlindRoom = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

const bottles: Bottle[] = [
  { id: 'b1', name: 'Stagg Jr.', status: 'open' },
  { id: 'b2', name: 'Eagle Rare', status: 'open' },
  { id: 'b3', name: 'Elijah Craig Barrel Proof', status: 'sealed' },
  { id: 'b4', name: 'Pappy 15', status: 'wishlist' },
]

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], username: 'kevin' } }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../data/repositories/blindRoom', () => ({
  createBlindRoom: (...args: unknown[]) => mockCreateBlindRoom(...args),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CreateBlindPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function goToBottlesStep() {
  await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // session -> flight
  await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // flight -> knowledge
  await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // knowledge -> name
  await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // name -> bottles
}

async function goToDeadlineStep() {
  await userEvent.click(screen.getByText('Blind Challenge'))
  await goToBottlesStep()
  await userEvent.click(screen.getByText('Stagg Jr.'))
  await userEvent.click(screen.getByText('Eagle Rare'))
  await userEvent.click(screen.getByText('Elijah Craig Barrel Proof'))
  await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // bottles -> deadline
}

describe('CreateBlindPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts on the Session Type step with Live Blind selected', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()

    expect(screen.getByRole('heading', { name: 'Session Type' })).toBeInTheDocument()
    expect(screen.getByText('Live Blind')).toBeInTheDocument()
    expect(screen.getByText('Blind Challenge')).toBeInTheDocument()
  })

  it('only shows the Deadline step for a Blind Challenge session', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()

    await userEvent.click(screen.getByText('Blind Challenge'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> flight
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> knowledge
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> name
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> bottles
    await userEvent.click(screen.getByText('Stagg Jr.'))
    await userEvent.click(screen.getByText('Eagle Rare'))
    await userEvent.click(screen.getByText('Elijah Craig Barrel Proof'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> deadline

    expect(screen.getByRole('heading', { name: 'Deadline' })).toBeInTheDocument()
  })

  it('disables Continue and shows an error for a deadline in the past', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await goToDeadlineStep()

    fireEvent.change(screen.getByLabelText('Challenge deadline'), { target: { value: '2020-01-01T10:00' } })

    expect(screen.getByText('Pick a deadline in the future.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('enables Continue once a future deadline is picked', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await goToDeadlineStep()

    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    fireEvent.change(screen.getByLabelText('Challenge deadline'), { target: { value: future } })

    expect(screen.queryByText('Pick a deadline in the future.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('excludes wishlist bottles from the Add Bottles step and requires exactly the flight size', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await goToBottlesStep()

    expect(screen.queryByText('Pappy 15')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await userEvent.click(screen.getByText('Stagg Jr.'))
    await userEvent.click(screen.getByText('Eagle Rare'))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await userEvent.click(screen.getByText('Elijah Craig Barrel Proof'))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('assigns pour letters in the order bottles are tapped', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await goToBottlesStep()

    await userEvent.click(screen.getByText('Eagle Rare'))
    await userEvent.click(screen.getByText('Stagg Jr.'))
    await userEvent.click(screen.getByText('Elijah Craig Barrel Proof'))

    const eagleRareRow = screen.getByText('Eagle Rare').closest('button')!
    const staggRow = screen.getByText('Stagg Jr.').closest('button')!
    expect(eagleRareRow).toHaveTextContent('A')
    expect(staggRow).toHaveTextContent('B')
  })

  it('creates the room on Review and navigates to its lobby', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    mockCreateBlindRoom.mockResolvedValue({ id: 'room-1', code: 'OAK742' })
    renderPage()
    await goToBottlesStep()
    await userEvent.click(screen.getByText('Stagg Jr.'))
    await userEvent.click(screen.getByText('Eagle Rare'))
    await userEvent.click(screen.getByText('Elijah Craig Barrel Proof'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> review

    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create Blind Room' }))

    expect(mockCreateBlindRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        hostUid: 'host-1',
        hostUsername: 'kevin',
        sessionType: 'live',
        knowledgeMode: 'single',
        pourCount: 3,
        pours: [
          expect.objectContaining({ label: 'A', bottleId: 'b1', bottleName: 'Stagg Jr.' }),
          expect.objectContaining({ label: 'B', bottleId: 'b2', bottleName: 'Eagle Rare' }),
          expect.objectContaining({ label: 'C', bottleId: 'b3', bottleName: 'Elijah Craig Barrel Proof' }),
        ],
      }),
    )
    expect(mockNavigate).toHaveBeenCalledWith('/blind/room-1/lobby')
  })

  it('creates a Solo Blind room and navigates straight to tasting, skipping the lobby', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    mockCreateBlindRoom.mockResolvedValue({ id: 'room-1', code: 'OAK742' })
    renderPage()

    await userEvent.click(screen.getByText('Solo Blind'))
    await goToBottlesStep()
    await userEvent.click(screen.getByText('Stagg Jr.'))
    await userEvent.click(screen.getByText('Eagle Rare'))
    await userEvent.click(screen.getByText('Elijah Craig Barrel Proof'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> review

    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create Blind Room' }))

    expect(mockCreateBlindRoom).toHaveBeenCalledWith(expect.objectContaining({ sessionType: 'solo' }))
    expect(mockNavigate).toHaveBeenCalledWith('/blind/room-1/taste')
  })

  it('Back on the first step returns to the Blind Room landing page', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockNavigate).toHaveBeenCalledWith('/blind')
  })
})
