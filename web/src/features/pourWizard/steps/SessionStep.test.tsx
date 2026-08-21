import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SessionStep } from './SessionStep'
import { blankDraft } from '../draft'

const mockUseAuth = vi.fn()
const mockUseFriends = vi.fn()

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../friends/useFriends', () => ({
  useFriends: (...args: unknown[]) => mockUseFriends(...args),
}))

describe('SessionStep — With field', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: 'viewer-uid' } })
    mockUseFriends.mockReturnValue({
      friends: [
        { uid: 'friend-1', username: 'dad', displayName: 'Dad' },
        { uid: 'friend-2', username: 'kevin', displayName: 'Kevin Littlejohn' },
      ],
      loading: false,
      reload: vi.fn(),
    })
  })

  it('surfaces real friends as suggestions when the field is focused', () => {
    const updateDraft = vi.fn()
    render(<SessionStep draft={blankDraft()} updateDraft={updateDraft} />)

    fireEvent.focus(screen.getByLabelText('With'))

    expect(screen.getByRole('option', { name: 'Dad' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Kevin Littlejohn' })).toBeInTheDocument()
  })

  it('selecting a friend sets companion text and tags them in sharedWithUids', () => {
    const updateDraft = vi.fn()
    const draft = { ...blankDraft(), sharedWithUids: ['friend-2'] }
    render(<SessionStep draft={draft} updateDraft={updateDraft} />)

    fireEvent.focus(screen.getByLabelText('With'))
    fireEvent.click(screen.getByRole('option', { name: 'Dad' }))

    // A trailing ", " is left on purpose so the very next friendOptions
    // call shows the remaining friends instead of re-searching for "dad" —
    // see SessionStep.tsx's currentSegment. It's stripped when the pour is
    // actually saved (PourWizard.tsx), not here in the editing field.
    expect(updateDraft).toHaveBeenLastCalledWith({ companion: 'Dad, ', sharedWithUids: ['friend-2', 'friend-1'] })
  })

  it('selecting a second friend appends after the last comma instead of replacing the field', () => {
    const updateDraft = vi.fn()
    const draft = { ...blankDraft(), companion: 'Dad, ', sharedWithUids: ['friend-1'] }
    render(<SessionStep draft={draft} updateDraft={updateDraft} />)

    fireEvent.focus(screen.getByLabelText('With'))

    // Dad is already added, so he no longer shows up as a suggestion —
    // only Kevin, the friend not yet picked.
    expect(screen.queryByRole('option', { name: 'Dad' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'Kevin Littlejohn' }))

    expect(updateDraft).toHaveBeenLastCalledWith({
      companion: 'Dad, Kevin Littlejohn, ',
      sharedWithUids: ['friend-1', 'friend-2'],
    })
  })

  it('still allows plain free-text companion entry, unaffected by the friends list', () => {
    const updateDraft = vi.fn()
    render(<SessionStep draft={blankDraft()} updateDraft={updateDraft} />)

    fireEvent.change(screen.getByLabelText('With'), { target: { value: 'firehouse crew' } })

    expect(updateDraft).toHaveBeenCalledWith({ companion: 'firehouse crew' })
  })
})
