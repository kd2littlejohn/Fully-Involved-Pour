import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JourneyTab } from './JourneyTab'
import type { Bottle, Memory, Pour } from '../../../data/types'

const mockUseUserData = vi.fn()

vi.mock('../../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'bottleId' | 'date' | 'rating'>): Pour {
  return {
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

function setUserDoc(bottles: Bottle[], pours: Pour[] = [], memories: Memory[] = []) {
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours, memories, infinityBottles: [], customLibrary: [] },
    loading: false,
    signedIn: true,
  })
}

const eagleRare: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: new Date('2026-05-03').getTime() }
const sealedBottle: Bottle = { id: 'b2', name: 'Weller 12', status: 'sealed', createdAt: new Date('2026-05-03').getTime() }
const wishlistBottle: Bottle = { id: 'b3', name: 'Pappy 15', status: 'wishlist' }

describe('JourneyTab', () => {
  it('shows the sealed-specific empty state with a pour action for a never-poured sealed bottle', () => {
    setUserDoc([sealedBottle])
    render(<JourneyTab bottle={sealedBottle} pours={[]} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.getByText("Your story with this bottle hasn't started yet.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start a Pour Story' })).toBeInTheDocument()
  })

  it('shows the generic empty state for a non-sealed bottle with no story content yet', () => {
    setUserDoc([wishlistBottle])
    render(<JourneyTab bottle={wishlistBottle} pours={[]} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.getByText("This bottle's journey is just beginning.")).toBeInTheDocument()
  })

  it('shows the story summary and tags the only pour First Pour', async () => {
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    setUserDoc([eagleRare], pours)
    render(<JourneyTab bottle={eagleRare} pours={pours} memories={[]} onViewAllPours={vi.fn()} />)

    expect(screen.getByText('Your Story')).toBeInTheDocument()
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
    render(<JourneyTab bottle={eagleRare} pours={[]} memories={memories} onViewAllPours={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Porch night/ }))

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(within(dialog).getByText('A great evening on the porch.')).toBeInTheDocument()
  })

  it('shows a Finished summary instead of First/Last Pour once the bottle is finished', () => {
    const finished: Bottle = { ...eagleRare, status: 'finished', openedDate: '2026-05-17', finishedDate: '2026-08-08' }
    const pours = [pour({ id: 'p1', bottleId: 'b1', date: '2026-05-17', rating: 8.6 })]
    setUserDoc([finished], pours)
    render(<JourneyTab bottle={finished} pours={pours} memories={[]} onViewAllPours={vi.fn()} />)

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
    render(<JourneyTab bottle={eagleRare} pours={pours} memories={[]} onViewAllPours={onViewAllPours} />)

    const link = screen.getByRole('button', { name: /View all 8 Pour Stories/ })
    await userEvent.click(link)
    expect(onViewAllPours).toHaveBeenCalled()
  })
})
