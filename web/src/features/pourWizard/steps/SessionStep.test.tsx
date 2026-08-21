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

    expect(updateDraft).toHaveBeenCalledWith({ companion: 'Dad' })
    expect(updateDraft).toHaveBeenCalledWith({ sharedWithUids: ['friend-2', 'friend-1'] })
  })

  it('still allows plain free-text companion entry, unaffected by the friends list', () => {
    const updateDraft = vi.fn()
    render(<SessionStep draft={blankDraft()} updateDraft={updateDraft} />)

    fireEvent.change(screen.getByLabelText('With'), { target: { value: 'firehouse crew' } })

    expect(updateDraft).toHaveBeenCalledWith({ companion: 'firehouse crew' })
  })
})
