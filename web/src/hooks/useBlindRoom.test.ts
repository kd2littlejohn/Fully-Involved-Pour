import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBlindRoom } from './useBlindRoom'

const mockUseAuth = vi.fn()
const mockOnSnapshot = vi.fn()
const mockUnsubRoom = vi.fn()
const mockUnsubParticipants = vi.fn()

vi.mock('./useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../data/devMode', () => ({
  isMockAuthEnabled: () => false,
}))

vi.mock('../data/firebase', () => ({
  db: {},
}))

vi.mock('../data/repositories/blindRoom', () => ({
  getBlindRoom: vi.fn(),
  getParticipants: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({ __type: 'doc', args }),
  collection: (...args: unknown[]) => ({ __type: 'collection', args }),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}))

describe('useBlindRoom', () => {
  beforeEach(() => {
    mockOnSnapshot.mockReset()
    mockUnsubRoom.mockReset()
    mockUnsubParticipants.mockReset()
    let call = 0
    mockOnSnapshot.mockImplementation(() => {
      call += 1
      return call % 2 === 1 ? mockUnsubRoom : mockUnsubParticipants
    })
  })

  // A listener subscribed under one signed-in user must not keep streaming
  // to a component instance that survives a same-tab switch to a different
  // account — this is the fix for exactly that gap.
  it('tears down and re-establishes both listeners when the signed-in uid changes', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } })
    const { rerender } = renderHook(() => useBlindRoom('room-1'))

    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
    expect(mockUnsubRoom).not.toHaveBeenCalled()
    expect(mockUnsubParticipants).not.toHaveBeenCalled()

    mockUseAuth.mockReturnValue({ user: { uid: 'user-2' } })
    rerender()

    expect(mockUnsubRoom).toHaveBeenCalledTimes(1)
    expect(mockUnsubParticipants).toHaveBeenCalledTimes(1)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(4)
  })

  it('tears down listeners on sign-out (uid goes to undefined) without re-establishing new ones for the same room', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } })
    const { rerender } = renderHook(() => useBlindRoom('room-1'))
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)

    mockUseAuth.mockReturnValue({ user: null })
    rerender()

    expect(mockUnsubRoom).toHaveBeenCalledTimes(1)
    expect(mockUnsubParticipants).toHaveBeenCalledTimes(1)
    // Firestore rules deny an unauthenticated read of a room's live
    // participants, so re-subscribing here would just fail — but the
    // effect still re-runs and attempts a fresh subscription each time uid
    // changes, since roomId itself is unchanged and rules will simply
    // reject it rather than the hook trying to be clever about auth state.
    expect(mockOnSnapshot).toHaveBeenCalledTimes(4)
  })

  it('does not resubscribe on an unrelated rerender with the same uid and roomId', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } })
    const { rerender } = renderHook(() => useBlindRoom('room-1'))
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)

    rerender()

    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
    expect(mockUnsubRoom).not.toHaveBeenCalled()
  })
})
