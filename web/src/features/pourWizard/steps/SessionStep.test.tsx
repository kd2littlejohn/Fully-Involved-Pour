import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SessionStep } from './SessionStep'
import { blankDraft } from '../draft'

const mockUseAuth = vi.fn()
const mockUseFriends = vi.fn()
const mockUseUserData = vi.fn()

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../friends/useFriends', () => ({
  useFriends: (...args: unknown[]) => mockUseFriends(...args),
}))

describe('SessionStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: 'viewer-uid' } })
    mockUseFriends.mockReturnValue({
      friends: [{ uid: 'friend-1', username: 'dad', displayName: 'Dad' }],
      loading: false,
      reload: vi.fn(),
    })
    mockUseUserData.mockReturnValue({
      userDoc: { people: [{ id: 'p1', name: 'Marcus', normalizedName: 'marcus', createdAt: 1 }] },
      addOrReusePerson: vi.fn(),
      updatePersonPhoto: vi.fn(),
    })
  })

  it('renders the Poured With picker, seeded with saved contacts', async () => {
    render(<SessionStep draft={blankDraft()} updateDraft={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('Add someone…'), 'Mar')
    expect(screen.getByRole('button', { name: 'Marcus' })).toBeInTheDocument()
  })

  it('selecting a suggested person updates draft.pouredWith without touching sharedWithUids', async () => {
    const updateDraft = vi.fn()
    render(<SessionStep draft={blankDraft()} updateDraft={updateDraft} />)

    await userEvent.type(screen.getByPlaceholderText('Add someone…'), 'Marcus')
    await userEvent.click(screen.getByRole('button', { name: /^Marcus$/ }))

    expect(updateDraft).toHaveBeenCalledWith({ pouredWith: [{ personId: 'p1', name: 'Marcus' }] })
  })

  it('still renders TagFriendsField for real-friend sharing, independent of Poured With', async () => {
    const updateDraft = vi.fn()
    render(<SessionStep draft={blankDraft()} updateDraft={updateDraft} />)

    await userEvent.click(screen.getByRole('button', { name: 'Dad' }))
    expect(updateDraft).toHaveBeenCalledWith({ sharedWithUids: ['friend-1'] })
  })
})
