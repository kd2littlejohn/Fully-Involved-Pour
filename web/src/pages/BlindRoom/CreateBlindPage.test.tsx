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

vi.mock('../../data/repositories/blindRoom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/blindRoom')>()
  return {
    ...actual,
    createBlindRoom: (...args: unknown[]) => mockCreateBlindRoom(...args),
  }
})

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

function pickBottle(label: string, bottleName: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: bottles.find((b) => b.name === bottleName)!.id } })
}

async function goToDeadlineStep() {
  await userEvent.click(screen.getByText('Blind Challenge'))
  await goToBottlesStep()
  pickBottle('Pour A', 'Stagg Jr.')
  pickBottle('Pour B', 'Eagle Rare')
  pickBottle('Pour C', 'Elijah Craig Barrel Proof')
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
    pickBottle('Pour A', 'Stagg Jr.')
    pickBottle('Pour B', 'Eagle Rare')
    pickBottle('Pour C', 'Elijah Craig Barrel Proof')
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

  it('defaults to a 3-pour flight, showing one Select Bottle slot per pour', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await goToBottlesStep()

    expect(screen.queryByText('Pappy 15')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Pour A')).toBeInTheDocument()
    expect(screen.getByLabelText('Pour B')).toBeInTheDocument()
    expect(screen.getByLabelText('Pour C')).toBeInTheDocument()
    expect(screen.queryByLabelText('Pour D')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    pickBottle('Pour A', 'Stagg Jr.')
    pickBottle('Pour B', 'Eagle Rare')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    pickBottle('Pour C', 'Elijah Craig Barrel Proof')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('assigns pour letters to whichever slot each bottle was picked for', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await goToBottlesStep()

    pickBottle('Pour A', 'Eagle Rare')
    pickBottle('Pour B', 'Stagg Jr.')
    pickBottle('Pour C', 'Elijah Craig Barrel Proof')

    expect(screen.getByLabelText('Pour A')).toHaveValue('b2')
    expect(screen.getByLabelText('Pour B')).toHaveValue('b1')
  })

  it('changing Number of Pours grows the bottle slots, defaulting to 3 for Flight and 2 for Head-to-Head', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // session -> flight

    fireEvent.change(screen.getByLabelText('Number of Pours'), { target: { value: '4' } })
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> knowledge
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> name
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // -> bottles

    expect(screen.getByLabelText('Pour D')).toBeInTheDocument()
  })

  it('defaults Head-to-Head to 2 pours and Flight to 3', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Continue' })) // session -> flight

    await userEvent.click(screen.getByRole('button', { name: /Head-to-Head/ }))
    expect(screen.getByLabelText('Number of Pours')).toHaveValue('2')

    await userEvent.click(screen.getByRole('button', { name: /^Flight/ }))
    expect(screen.getByLabelText('Number of Pours')).toHaveValue('3')
  })

  it('prevents the same bottle from being selected for two different pours', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    renderPage()
    await goToBottlesStep()

    pickBottle('Pour A', 'Stagg Jr.')

    const pourBSelect = screen.getByLabelText('Pour B') as HTMLSelectElement
    const staggOptionInB = Array.from(pourBSelect.options).find((o) => o.value === 'b1')!
    expect(staggOptionInB.disabled).toBe(true)
  })

  it('confirms before dropping an already-picked bottle when the pour count is reduced', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await goToBottlesStep()
    pickBottle('Pour A', 'Stagg Jr.')
    pickBottle('Pour B', 'Eagle Rare')
    pickBottle('Pour C', 'Elijah Craig Barrel Proof')
    await userEvent.click(screen.getByRole('button', { name: 'Back' })) // -> name
    await userEvent.click(screen.getByRole('button', { name: 'Back' })) // -> knowledge
    await userEvent.click(screen.getByRole('button', { name: 'Back' })) // -> flight

    fireEvent.change(screen.getByLabelText('Number of Pours'), { target: { value: '2' } })

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('remove 1 already-selected bottle'))
    confirmSpy.mockRestore()
  })

  it('keeps the pour count unchanged if the shrink confirmation is declined', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()
    await goToBottlesStep()
    pickBottle('Pour A', 'Stagg Jr.')
    pickBottle('Pour B', 'Eagle Rare')
    pickBottle('Pour C', 'Elijah Craig Barrel Proof')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' })) // -> flight

    fireEvent.change(screen.getByLabelText('Number of Pours'), { target: { value: '2' } })

    expect(screen.getByLabelText('Number of Pours')).toHaveValue('3')
    confirmSpy.mockRestore()
  })

  it('creates the room on Review and navigates to its lobby', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1', displayName: 'Kevin' } })
    mockCreateBlindRoom.mockResolvedValue({ id: 'room-1', code: 'OAK742' })
    renderPage()
    await goToBottlesStep()
    pickBottle('Pour A', 'Stagg Jr.')
    pickBottle('Pour B', 'Eagle Rare')
    pickBottle('Pour C', 'Elijah Craig Barrel Proof')
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
    pickBottle('Pour A', 'Stagg Jr.')
    pickBottle('Pour B', 'Eagle Rare')
    pickBottle('Pour C', 'Elijah Craig Barrel Proof')
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
