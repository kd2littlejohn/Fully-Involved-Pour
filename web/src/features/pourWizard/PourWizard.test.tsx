import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PourWizard } from './PourWizard'

const mockAddPour = vi.fn().mockResolvedValue(undefined)
const mockGenerateAndSaveTastingSummary = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [] },
    addPour: mockAddPour,
    updatePourAiSummary: vi.fn(),
  }),
}))

vi.mock('./tastingSummaryOnSave', () => ({
  generateAndSaveTastingSummary: (...args: unknown[]) => mockGenerateAndSaveTastingSummary(...args),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' }, loading: false }),
}))

// The Session step's friend-tagging field (see features/friends/
// TagFriendsField) reads this repository — mocked so it never attempts a
// real Firestore call in tests.
vi.mock('../../data/repositories/relationships', () => ({
  getFriendIds: () => Promise.resolve([]),
}))

beforeEach(() => {
  localStorage.clear()
  mockAddPour.mockClear()
  mockGenerateAndSaveTastingSummary.mockClear()
})

async function goNext() {
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
}

describe('PourWizard', () => {
  it('walks all six steps, computes the correct total, and saves the pour', async () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<PourWizard bottleId="b1" bottleName="Eagle Rare" onClose={onClose} onSaved={onSaved} />)

    // Session
    expect(screen.getByText('Add a Pour Story — Eagle Rare')).toBeInTheDocument()
    await goNext()

    // Nose
    fireEvent.change(screen.getByLabelText('Nose'), { target: { value: '2' } })
    await userEvent.click(screen.getByRole('button', { name: 'Vanilla' }))
    await goNext()

    // Palate
    fireEvent.change(screen.getByLabelText('Palate'), { target: { value: '3' } })
    await userEvent.click(screen.getByRole('button', { name: 'Oak' }))
    await goNext()

    // Finish
    fireEvent.change(screen.getByLabelText('Finish'), { target: { value: '1.5' } })
    await goNext()

    // Complexity
    fireEvent.change(screen.getByLabelText('Complexity & Balance'), { target: { value: '0.8' } })
    await userEvent.selectOptions(screen.getByLabelText('Would you buy it again?'), 'absolutely')
    await goNext()

    // Summary: 2 + 3 + 1.5 + 0.8 + 1 (absolutely) = 8.3 → Working Fire (8.0–8.9)
    expect(screen.getByText('8.3')).toBeInTheDocument()
    expect(screen.getByText('Working Fire')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('The memory'), 'Great porch pour.')
    await userEvent.click(screen.getByRole('button', { name: 'Save Story' }))

    expect(mockAddPour).toHaveBeenCalledWith(
      expect.objectContaining({
        bottleId: 'b1',
        rating: 8.3,
        memory: 'Great porch pour.',
        buyAgain: 'absolutely',
        fip: expect.objectContaining({
          nose: 2,
          palate: 3,
          finish: 1.5,
          complexity: 0.8,
          value: 1,
          total: 8.3,
          noseAromas: ['Vanilla'],
          palateFlavors: ['Oak'],
        }),
      }),
    )
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    // addPour resolved undefined in this test, so there's no saved pour to
    // generate a tasting summary for.
    expect(mockGenerateAndSaveTastingSummary).not.toHaveBeenCalled()
  })

  it('fires the tasting summary generator in the background once a real saved pour comes back, after onSaved/onClose', async () => {
    const saved = {
      id: 'p-new',
      bottleId: 'b1',
      date: '2026-08-14',
      rating: 8.3,
      fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 1, total: 8.3, noseAromas: ['Vanilla'], palateFlavors: ['Oak'] },
    }
    mockAddPour.mockResolvedValueOnce(saved)
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<PourWizard bottleId="b1" bottleName="Eagle Rare" onClose={onClose} onSaved={onSaved} />)

    for (let i = 0; i < 5; i++) {
      await goNext()
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save Story' }))

    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(mockGenerateAndSaveTastingSummary).toHaveBeenCalledWith(saved, expect.any(Function))
  })

  it('strips the trailing separator the friend Combobox leaves on the With field before saving', async () => {
    const onClose = vi.fn()
    render(<PourWizard bottleId="b4" bottleName="Weller 12" onClose={onClose} />)

    // Mirrors what SessionStep's friend Combobox leaves behind after
    // picking one or more friends (see SessionStep.tsx's
    // handleCompanionSelect) — the trailing ", " should never reach saved
    // pour data.
    fireEvent.change(screen.getByLabelText('With'), { target: { value: 'Dad, Kevin Littlejohn, ' } })
    await goNext() // Session -> Nose
    await goNext() // Nose -> Palate
    await goNext() // Palate -> Finish
    await goNext() // Finish -> Complexity
    await goNext() // Complexity -> Summary

    await userEvent.click(screen.getByRole('button', { name: 'Save Story' }))

    expect(mockAddPour).toHaveBeenCalledWith(expect.objectContaining({ companion: 'Dad, Kevin Littlejohn' }))
  })

  it('persists a draft to localStorage so reopening the wizard resumes it', async () => {
    const onClose = vi.fn()
    const { unmount } = render(<PourWizard bottleId="b2" bottleName="Weller 12" onClose={onClose} />)

    await goNext() // Session -> Nose
    fireEvent.change(screen.getByLabelText('Nose'), { target: { value: '2.2' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(onClose).toHaveBeenCalled()
    unmount()

    render(<PourWizard bottleId="b2" bottleName="Weller 12" onClose={vi.fn()} />)
    await goNext() // Session -> Nose again
    expect(screen.getByLabelText('Nose')).toHaveValue('2.2')
  })

  it('keeps drafts separate per bottle', async () => {
    render(<PourWizard bottleId="b3" bottleName="Blanton's" onClose={vi.fn()} />)
    await goNext()
    expect(screen.getByLabelText('Nose')).toHaveValue('0')
  })
})
