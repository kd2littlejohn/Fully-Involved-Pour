import type { ReactElement } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JourneyTab } from './JourneyTab'
import type { Bottle, Memory, Pour } from '../../../data/types'

const mockUseUserData = vi.fn()
const mockUseAuth = vi.fn()
const mockGetBottleBlindHistory = vi.fn()
const mockDeleteBlindRoom = vi.fn()

vi.mock('../../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../../data/repositories/blindRoom', () => ({
  getBottleBlindHistory: (...args: unknown[]) => mockGetBottleBlindHistory(...args),
  deleteBlindRoom: (...args: unknown[]) => mockDeleteBlindRoom(...args),
}))

function renderTab(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return {
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

function setUserDoc(bottles: Bottle[], pours: Pour[] = [], memories: Memory[] = []) {
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours, memories, infinityBottles: [], customLibrary: [], people: [] },
    loading: false,
    signedIn: true,
  })
}

const eagleRare: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: new Date('2026-05-03').getTime() }
const sealedBottle: Bottle = { id: 'b2', name: 'Weller 12', status: 'sealed', createdAt: new Date('2026-05-03').getTime() }
const wishlistBottle: Bottle = { id: 'b3', name: 'Pappy 15', status: 'wishlist' }

describe('JourneyTab', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    mockGetBottleBlindHistory.mockReset()
    mockGetBottleBlindHistory.mockResolvedValue([])
    mockDeleteBlindRoom.mockReset()
    mockDeleteBlindRoom.mockResolvedValue(undefined)
    localStorage.clear()
  })

  it('shows the sealed-specific empty state with a pour action for a never-poured sealed bottle', () => {
    setUserDoc([sealedBottle])
    renderTab(<JourneyTab bottle={sealedBottle} pours={[]} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.getByText("Your story with this bottle hasn't started yet.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start a Pour Story' })).toBeInTheDocument()
  })

  it('shows the generic empty state for a non-sealed bottle with no story content yet', () => {
    setUserDoc([wishlistBottle])
    renderTab(<JourneyTab bottle={wishlistBottle} pours={[]} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.getByText("This bottle's journey is just beginning.")).toBeInTheDocument()
  })

  it('shows the story summary and tags the only pour First Pour', async () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    setUserDoc([eagleRare], pours)
    renderTab(<JourneyTab bottle={eagleRare} pours={pours} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.getByText('Bottle Journey')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('First Pour')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Pour — 8\.6/ }))
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument()
  })

  it('opens the linked memory detail when a memory event is clicked', async () => {
    const memories: Memory[] = [
      { id: 'm1', title: 'Porch night', date: '2026-06-15', people: ['Dad'], bottleId: 'b1', story: 'A great evening on the porch.' },
    ]
    setUserDoc([eagleRare], [], memories)
    renderTab(<JourneyTab bottle={eagleRare} pours={[]} memories={memories} onViewAllPours={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Porch night/ }))

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(within(dialog).getByText('A great evening on the porch.')).toBeInTheDocument()
  })

  it('shows a Finished summary instead of First/Last Pour once the bottle is finished', () => {
    const finished: Bottle = { ...eagleRare, status: 'finished', openedDate: '2026-05-17', finishedDate: '2026-08-08' }
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    setUserDoc([finished], pours)
    renderTab(<JourneyTab bottle={finished} pours={pours} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.getAllByText(/Opened/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Finished/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Last Pour/)).not.toBeInTheDocument()
  })

  it('curates a long history and lets the user jump to the full Pour Stories tab', async () => {
    const pours = Array.from({ length: 8 }, (_, i) =>
      pour({ id: `p${i}`, bottleId: 'b1', date: `2026-0${(i % 9) + 1}-01`, rating: 8 + i * 0.1 }),
    )
    setUserDoc([eagleRare], pours)
    const onViewAllPours = vi.fn()
    renderTab(<JourneyTab bottle={eagleRare} pours={pours} memories={[]} onViewAllPours={onViewAllPours} />)

    const link = screen.getByRole('button', { name: /View all 8 Pour Stories/ })
    await userEvent.click(link)
    expect(onViewAllPours).toHaveBeenCalled()
  })

  it('shows Blind History alongside the full story content when the bottle has both', async () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    setUserDoc([eagleRare], pours)
    mockGetBottleBlindHistory.mockResolvedValue([
      {
        room: { id: 'room-1', name: 'Friday Night Blind', revealedAt: Date.now() },
        pour: { label: 'B', bottleId: 'b1', bottleName: 'Eagle Rare' },
        myResponse: { pourLabel: 'B', reaction: 'Love It', fipScore: 9.1, status: 'locked', updatedAt: Date.now() },
      },
    ])
    renderTab(<JourneyTab bottle={eagleRare} pours={pours} memories={[]} onViewAllPours={vi.fn()} />)

    expect(await screen.findByText('Blind History')).toBeInTheDocument()
    expect(screen.getByText('Friday Night Blind')).toBeInTheDocument()
    expect(screen.getByText('9.1')).toBeInTheDocument()
    expect(screen.getByText('Love It')).toBeInTheDocument()
    expect(mockGetBottleBlindHistory).toHaveBeenCalledWith('u1', 'b1')
  })

  it('shows Blind History even for a sealed bottle with no locally-logged pours', async () => {
    setUserDoc([sealedBottle])
    mockGetBottleBlindHistory.mockResolvedValue([
      {
        room: { id: 'room-2', name: 'Blind Tasting Night', revealedAt: Date.now() },
        pour: { label: 'A', bottleId: 'b2', bottleName: 'Weller 12' },
        myResponse: undefined,
      },
    ])
    renderTab(<JourneyTab bottle={sealedBottle} pours={[]} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.getByText("Your story with this bottle hasn't started yet.")).toBeInTheDocument()
    expect(await screen.findByText('Blind Tasting Night')).toBeInTheDocument()
  })

  it('shows no Blind History section when there is none', () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    setUserDoc([eagleRare], pours)
    renderTab(<JourneyTab bottle={eagleRare} pours={pours} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.queryByText('Blind History')).not.toBeInTheDocument()
  })

  it('lets the host delete a Blind History entry and removes it immediately, no refetch', async () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    setUserDoc([eagleRare], pours)
    mockGetBottleBlindHistory.mockResolvedValue([
      {
        room: { id: 'room-1', name: 'Friday Night Blind', hostUid: 'u1', revealedAt: Date.now() },
        pour: { label: 'B', bottleId: 'b1', bottleName: 'Eagle Rare' },
        myResponse: { pourLabel: 'B', reaction: 'Love It', fipScore: 9.1, status: 'locked', updatedAt: Date.now() },
      },
    ])
    renderTab(<JourneyTab bottle={eagleRare} pours={pours} memories={[]} onViewAllPours={vi.fn()} />)
    await screen.findByText('Friday Night Blind')

    await userEvent.click(screen.getByRole('button', { name: 'Friday Night Blind actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete Blind' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Blind for Everyone' }))

    await waitFor(() => expect(mockDeleteBlindRoom).toHaveBeenCalledWith('room-1'))
    expect(screen.queryByText('Friday Night Blind')).not.toBeInTheDocument()
    expect(screen.queryByText('Blind History')).not.toBeInTheDocument()
  })

  it('lets a non-host remove a Blind History entry from just their own history', async () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    setUserDoc([eagleRare], pours)
    mockGetBottleBlindHistory.mockResolvedValue([
      {
        room: { id: 'room-1', name: 'Friday Night Blind', hostUid: 'someone-else', revealedAt: Date.now() },
        pour: { label: 'B', bottleId: 'b1', bottleName: 'Eagle Rare' },
        myResponse: { pourLabel: 'B', reaction: 'Love It', fipScore: 9.1, status: 'locked', updatedAt: Date.now() },
      },
    ])
    renderTab(<JourneyTab bottle={eagleRare} pours={pours} memories={[]} onViewAllPours={vi.fn()} />)
    await screen.findByText('Friday Night Blind')

    await userEvent.click(screen.getByRole('button', { name: 'Friday Night Blind actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete Blind' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove From My History' }))

    expect(mockDeleteBlindRoom).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Friday Night Blind')).not.toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem('fip:hiddenBlindRooms:u1') ?? '[]')).toEqual(['room-1'])
  })
})
