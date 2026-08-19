import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickPour } from './QuickPour'

const mockAddPour = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ addPour: mockAddPour }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

// The "Shared with" friend-tagging field (see features/friends/
// TagFriendsField) reads this repository — mocked to an empty friend list
// so it never attempts a real Firestore call in tests.
vi.mock('../../data/repositories/relationships', () => ({
  getFriendIds: () => Promise.resolve([]),
}))

vi.mock('../pourWizard/PourWizard', () => ({
  PourWizard: ({ bottleName, existingPour }: { bottleName: string; existingPour?: { id: string } }) => (
    <div>
      Full Wizard — {bottleName} (editing {existingPour?.id})
    </div>
  ),
}))

beforeEach(() => {
  mockAddPour.mockReset()
  mockAddPour.mockResolvedValue(undefined)
})

describe('QuickPour', () => {
  it('does not show flavor chips or a score until a reaction is picked', () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    expect(screen.queryByText('What stands out? (optional)')).not.toBeInTheDocument()
    expect(screen.queryByText('FIP Score')).not.toBeInTheDocument()
  })

  it('disables Save Pour until a reaction is picked', () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save Pour' })).toBeDisabled()
  })

  it('reveals flavor chips and an always-visible score once a reaction is picked', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))

    expect(screen.getByText('What stands out? (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('FIP score')).toBeInTheDocument()
    expect(screen.getByText('9.3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Pour' })).toBeEnabled()
  })

  it('saves in two taps: reaction, then Save Pour — no flavors or score adjustment required', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={onClose} onSaved={onSaved} />)

    await userEvent.click(screen.getByRole('button', { name: /Enjoying It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    expect(mockAddPour).toHaveBeenCalledTimes(1)
    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.bottleId).toBe('b1')
    expect(saved.rating).toBe(8.3)
    expect(saved.mood).toBe('Enjoying It')
    expect(saved.fip.palateFlavors).toEqual([])
    expect(onSaved).toHaveBeenCalled()
    // addPour resolved undefined here (no confirmation view possible), so the
    // fast path just closes.
    expect(onClose).toHaveBeenCalled()
  })

  it('includes tapped flavor chips in the saved pour', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Vanilla' }))
    await userEvent.click(screen.getByRole('button', { name: 'Oak' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.fip.palateFlavors).toEqual(['Vanilla', 'Oak'])
  })

  it('lets the reaction-implied score be adjusted before saving', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))

    const slider = screen.getByLabelText('FIP score')
    fireChange(slider, '7.5')
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.rating).toBe(7.5)
  })

  it('switching reactions replaces the previous selection rather than stacking', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByRole('button', { name: /Not For Me/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.mood).toBe('Not For Me')
    expect(saved.rating).toBe(4.0)
  })

  it('includes optional note, companion, and location fields when filled in', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByText('Add a note, company, or photo (optional)'))
    await userEvent.type(screen.getByLabelText('Note'), 'Great porch pour')
    await userEvent.type(screen.getByLabelText("Who's with you"), 'Dave')
    await userEvent.type(screen.getByLabelText('Where'), 'Back porch')
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.notes).toBe('Great porch pour')
    expect(saved.companion).toBe('Dave')
    expect(saved.location).toBe('Back porch')
  })

  it('shows a confirmation view with Done and Tell the Full Story after saving, when a pour comes back', async () => {
    mockAddPour.mockResolvedValue({
      id: 'p1',
      bottleId: 'b1',
      date: '2026-08-14',
      rating: 9.3,
      fip: { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: 9.3, noseAromas: [], palateFlavors: [] },
    })
    const onClose = vi.fn()
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    expect(screen.getByText('9.3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tell the Full Story' })).toBeInTheDocument()
    // The confirmation view is shown in place of closing immediately.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('opens the full wizard on the saved pour when Tell the Full Story is tapped', async () => {
    mockAddPour.mockResolvedValue({
      id: 'p1',
      bottleId: 'b1',
      date: '2026-08-14',
      rating: 9.3,
      fip: { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: 9.3, noseAromas: [], palateFlavors: [] },
    })
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love It/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tell the Full Story' }))

    expect(screen.getByText('Full Wizard — Eagle Rare (editing p1)')).toBeInTheDocument()
  })
})

function fireChange(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
