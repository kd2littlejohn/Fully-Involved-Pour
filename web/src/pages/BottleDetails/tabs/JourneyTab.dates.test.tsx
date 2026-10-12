import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JourneyTab } from './JourneyTab'
import { ChangeBottleStatusModal } from '../../../components/domain/ChangeBottleStatusModal'
import { blankDraft, pourToDraft } from '../../../features/pourWizard/draft'
import { buildBottleStoryEvents } from '../../../features/bottleDetails/selectors'
import type { Bottle, Pour } from '../../../data/types'

// Bottle Journey showed each event a day early for anyone west of UTC, and
// "today" defaults saved evening actions a day late. Tests run in UTC by
// default, which hid both, so this file runs in Pacific time.
// vi.hoisted runs before the imports, so module-level Intl formatters
// (Timeline, BottleStorySummary) are created in this timezone too.
const tz = vi.hoisted(() => {
  // The app's tsconfig has no Node types, hence the cast.
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
  const previous = env.TZ
  env.TZ = 'America/Los_Angeles'
  return { env, previous }
})
afterAll(() => {
  if (tz.previous === undefined) delete tz.env.TZ
  else tz.env.TZ = tz.previous
})

const mockUseUserData = vi.fn()
vi.mock('../../../hooks/useUserData', () => ({ useUserData: () => mockUseUserData() }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, loading: false }) }))
vi.mock('../../../data/repositories/blindRoom', () => ({
  getBottleBlindHistory: () => Promise.resolve([]),
  deleteBlindRoom: () => Promise.resolve(),
}))

// Added Oct 9 at 9:15pm Pacific (already Oct 10 in UTC), opened Oct 10,
// first poured Oct 11, poured again Oct 12: the raw values as saved.
const ADDED_AT = new Date(2026, 9, 9, 21, 15).getTime()
const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: ADDED_AT, openedDate: '2026-10-10' }
const fip = (total: number) => ({ nose: 2, palate: 3, finish: 1.5, complexity: 1, value: 1, total, noseAromas: [], palateFlavors: [] })
const pours: Pour[] = [
  { id: 'p1', bottleId: 'b1', date: '2026-10-11', rating: 8.6, fip: fip(8.6) },
  { id: 'p2', bottleId: 'b1', date: '2026-10-12', rating: 9.1, fip: fip(9.1) },
]

beforeEach(() => {
  mockUseUserData.mockReturnValue({
    userDoc: { bottles: [bottle], pours, memories: [], infinityBottles: [], customLibrary: [], people: [] },
    loading: false,
    signedIn: true,
  })
})
afterEach(() => {
  vi.useRealTimers()
})

// The timeline's date column, top to bottom, paired with each event label.
function timelineRows(): string[] {
  const labels = ['Added to your bar', 'Opened', 'Pour — 8.6', 'Pour — 9.1']
  return labels.map((label) => {
    const event = screen.getByText(label).closest<HTMLElement>('[class*="_event_"]')!
    return `${label}: ${within(event).getByText(/^\w{3} \d{1,2}, \d{4}$/).textContent}`
  })
}

const EXPECTED = ['Added to your bar: Oct 9, 2026', 'Opened: Oct 10, 2026', 'Pour — 8.6: Oct 11, 2026', 'Pour — 9.1: Oct 12, 2026']

function JourneyFor({ b, p }: { b: Bottle; p: Pour[] }) {
  return <JourneyTab bottle={b} pours={p} memories={[]} onViewAllPours={vi.fn()} />
}

describe('Bottle Journey dates', () => {
  it('shows each event on the day it was saved, in order', () => {
    render(
      <MemoryRouter>
        <JourneyFor b={bottle} p={pours} />
      </MemoryRouter>,
    )
    expect(timelineRows()).toEqual(EXPECTED)
    expect(screen.getByText('First Pour Oct 11')).toBeInTheDocument()
    expect(screen.getByText('Last Pour Oct 12')).toBeInTheDocument()
  })

  it('orders an evening addition before the next day’s opening (not by UTC timestamp)', () => {
    const story = buildBottleStoryEvents(bottle, pours, [])
    expect(story.events.map((e) => `${e.id}@${e.date}`)).toEqual([
      'added@2026-10-09',
      'opened@2026-10-10',
      'pour-p1@2026-10-11',
      'pour-p2@2026-10-12',
    ])
  })

  it('keeps the same dates after an unrelated edit to the bottle', () => {
    const view = render(
      <MemoryRouter>
        <JourneyFor b={bottle} p={pours} />
      </MemoryRouter>,
    )
    // updateBottle spreads the patch over the bottle; createdAt is never in a patch.
    const edited: Bottle = { ...bottle, ...{ name: 'Eagle Rare 10', fillLevel: 'half' as const } }
    view.rerender(
      <MemoryRouter>
        <JourneyFor b={edited} p={pours} />
      </MemoryRouter>,
    )
    expect(timelineRows()).toEqual(EXPECTED)
    expect(edited.createdAt).toBe(ADDED_AT)
    expect(edited.openedDate).toBe('2026-10-10')
  })

  it('keeps the same dates after a refresh (Firestore/cache JSON round trip)', () => {
    const reloaded = JSON.parse(JSON.stringify({ bottle, pours })) as { bottle: Bottle; pours: Pour[] }
    render(
      <MemoryRouter>
        <JourneyFor b={reloaded.bottle} p={reloaded.pours} />
      </MemoryRouter>,
    )
    expect(timelineRows()).toEqual(EXPECTED)
  })

  it('keeps the same dates after navigating away and back', async () => {
    render(
      <MemoryRouter initialEntries={['/collection/b1']}>
        <Routes>
          <Route
            path="/collection/b1"
            element={
              <>
                <Link to="/collection">away</Link>
                <JourneyFor b={bottle} p={pours} />
              </>
            }
          />
          <Route path="/collection" element={<Link to="/collection/b1">back</Link>} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('link', { name: 'away' }))
    await userEvent.click(screen.getByRole('link', { name: 'back' }))
    expect(timelineRows()).toEqual(EXPECTED)
  })

  it('a finished bottle shows its real opened and finished days', () => {
    const finished: Bottle = { ...bottle, status: 'finished', finishedDate: '2026-10-12' }
    render(
      <MemoryRouter>
        <JourneyFor b={finished} p={pours} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Opened Oct 10')).toBeInTheDocument()
    expect(screen.getByText('Finished Oct 12')).toBeInTheDocument()
  })
})

describe('dates saved by everyday actions', () => {
  it('opening a bottle at 8:30pm saves that evening’s date, and never rewrites an existing one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 10, 20, 30)) // Oct 10, 8:30pm Pacific = Oct 11 UTC
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const sealed: Bottle = { id: 'b9', name: 'Weller 12', status: 'sealed' }

    const view = render(<ChangeBottleStatusModal bottle={sealed} onUpdate={onUpdate} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Opened' }))
    expect(onUpdate).toHaveBeenCalledWith('b9', { status: 'open', openedDate: '2026-10-10' })
    view.unmount()

    onUpdate.mockClear()
    render(<ChangeBottleStatusModal bottle={{ ...bottle, status: 'open' }} onUpdate={onUpdate} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Finished' }))
    expect(onUpdate).toHaveBeenCalledWith('b1', { status: 'finished', finishedDate: '2026-10-10' })
    expect(onUpdate.mock.calls[0]![1]).not.toHaveProperty('openedDate')
  })

  it('a new Pour Story defaults to the local day; editing a pour keeps its saved date', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 11, 22, 0)) // Oct 11, 10pm Pacific
    expect(blankDraft().date).toBe('2026-10-11')
    expect(pourToDraft(pours[0]!, []).date).toBe('2026-10-11')
    expect(pourToDraft({ ...pours[0]!, date: '2026-10-01' }, []).date).toBe('2026-10-01')
  })
})
