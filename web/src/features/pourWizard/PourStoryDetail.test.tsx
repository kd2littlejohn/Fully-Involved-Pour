import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PourStoryDetail } from './PourStoryDetail'
import type { Bottle, Pour, PourPerson } from '../../data/types'

const mockUpdatePour = vi.fn().mockResolvedValue(undefined)
const mockDeletePour = vi.fn().mockResolvedValue(undefined)
let mockPeople: PourPerson[] = []

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: [], pours: [], memories: [], infinityBottles: [], customLibrary: [], get people() { return mockPeople } },
    updatePour: mockUpdatePour,
    deletePour: mockDeletePour,
    addPour: vi.fn(),
    updatePourAiSummary: vi.fn(),
    updatePourMemoryPhoto: vi.fn(),
    addOrReusePerson: vi.fn(),
    updatePersonPhoto: vi.fn(),
  }),
}))

// The Session step's friend-tagging field (see features/friends/
// TagFriendsField) reads this repository — mocked so it never attempts a
// real Firestore call in tests.
vi.mock('../../data/repositories/relationships', () => ({
  getFriendIds: () => Promise.resolve([]),
}))

beforeEach(() => {
  mockUpdatePour.mockClear()
  mockDeletePour.mockClear()
  mockPeople = []
})

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }

const pour: Pour = {
  id: 'p1',
  bottleId: 'b1',
  date: '2026-06-01',
  rating: 8.6,
  companion: 'Dad',
  location: 'Back porch',
  memory: 'Great catch-up.',
  buyAgain: 'probably',
  fip: {
    nose: 2.1,
    palate: 3.0,
    finish: 1.7,
    complexity: 0.8,
    value: 0.75,
    total: 8.6,
    noseAromas: ['Vanilla'],
    palateFlavors: ['Oak'],
    noseNotes: 'Sweet and warm.',
  },
}

describe('PourStoryDetail', () => {
  it('shows the full read-only pour story', () => {
    render(<PourStoryDetail pour={pour} bottle={bottle} onClose={vi.fn()} />)

    expect(screen.getByText('Eagle Rare')).toBeInTheDocument()
    expect(screen.getByText('Back porch')).toBeInTheDocument()
    expect(screen.getByText('Dad')).toBeInTheDocument()
    expect(screen.getByText('Great catch-up.')).toBeInTheDocument()
    expect(screen.getAllByText('Vanilla').length).toBeGreaterThan(0)
    expect(screen.getByText('Sweet and warm.')).toBeInTheDocument()
  })

  it('shows the memory photo prominently near the top when the pour has one', () => {
    const withPhoto: Pour = { ...pour, memoryPhoto: { url: 'https://example.com/moment.jpg', createdAt: 1 } }
    const { container } = render(<PourStoryDetail pour={withPhoto} bottle={bottle} onClose={vi.fn()} />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/moment.jpg')
  })

  it('renders no memory photo element when the pour has none', () => {
    const { container } = render(<PourStoryDetail pour={pour} bottle={bottle} onClose={vi.fn()} />)
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('shows a Poured With avatar for a structured person, using their real avatar', () => {
    mockPeople.push({ id: 'pp1', name: 'Dad', normalizedName: 'dad', photoUrl: 'https://example.com/dad.jpg', createdAt: 1 })
    const withPerson: Pour = { ...pour, companion: undefined, pouredWith: [{ personId: 'pp1', name: 'Dad' }] }
    const { container } = render(<PourStoryDetail pour={withPerson} bottle={bottle} onClose={vi.fn()} />)

    expect(screen.getByText('Dad')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/dad.jpg')
  })

  it('shows no "Your Pour" section when no AI summary has been generated yet', () => {
    render(<PourStoryDetail pour={pour} bottle={bottle} onClose={vi.fn()} />)

    expect(screen.queryByText('Your Pour')).not.toBeInTheDocument()
  })

  it('shows the AI summary under "Your Pour" once generated, alongside the untouched original notes', () => {
    const withSummary: Pour = {
      ...pour,
      aiSummary: { text: 'You picked up on vanilla and oak, a warm and easy pour.', sourceHash: 'h1', generatedAt: Date.now() },
    }
    render(<PourStoryDetail pour={withSummary} bottle={bottle} onClose={vi.fn()} />)

    expect(screen.getByText('Your Pour')).toBeInTheDocument()
    expect(screen.getByText('You picked up on vanilla and oak, a warm and easy pour.')).toBeInTheDocument()
    expect(screen.getByText('FIP summarized this from your tasting notes.')).toBeInTheDocument()

    // The user's own original notes still render completely unchanged.
    expect(screen.getByText('Sweet and warm.')).toBeInTheDocument()
    expect(screen.getAllByText('Vanilla').length).toBeGreaterThan(0)
  })

  it('requires confirmation before deleting, then calls deletePour and closes', async () => {
    const onClose = vi.fn()
    render(<PourStoryDetail pour={pour} bottle={bottle} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockDeletePour).not.toHaveBeenCalled()
    expect(screen.getByText('Delete this Pour Story?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))
    expect(mockDeletePour).toHaveBeenCalledWith('p1')
    expect(onClose).toHaveBeenCalled()
  })

  it('opens the wizard prefilled when Edit is clicked, and saves via updatePour', async () => {
    const onClose = vi.fn()
    render(<PourStoryDetail pour={pour} bottle={bottle} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Edit Pour Story — Eagle Rare')).toBeInTheDocument()
    // The legacy `companion: 'Dad'` string resolves into a Poured With chip
    // (no linked contact yet, since none exists in this test's empty people
    // list — see pourPeople.ts's resolvePouredWith).
    expect(screen.getByText('Dad')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next' })) // -> Nose
    expect(screen.getByLabelText('Nose')).toHaveValue('2.1')

    // Advance through the remaining steps to Summary and save unchanged.
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdatePour).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        date: '2026-06-01',
        companion: 'Dad',
        fip: expect.objectContaining({ nose: 2.1, total: 8.4 }),
      }),
    )
    expect(onClose).toHaveBeenCalled()
  })
})
