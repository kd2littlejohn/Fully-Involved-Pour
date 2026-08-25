import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSharedWithYou } from './useSharedWithYou'
import { hideSharedMomentForUser } from '../../data/hiddenSharedMoments'
import type { SharedMoment } from '../../data/types'

const mockGetSharedMomentsForParticipant = vi.fn()
const mockGetRecommendationsForRecipient = vi.fn()

vi.mock('../../data/repositories/sharedMoments', () => ({
  getSharedMomentsForParticipant: (...args: unknown[]) => mockGetSharedMomentsForParticipant(...args),
}))

vi.mock('../../data/repositories/recommendations', () => ({
  getRecommendationsForRecipient: (...args: unknown[]) => mockGetRecommendationsForRecipient(...args),
}))

beforeEach(() => {
  localStorage.clear()
  mockGetRecommendationsForRecipient.mockResolvedValue([])
})

function moment(id: string): SharedMoment {
  return {
    id,
    storyId: `p-${id}`,
    ownerId: 'friend-1',
    ownerUsername: 'kevin',
    participantIds: ['me'],
    acceptedParticipantIds: [],
    snapshot: { bottleName: 'Stagg', date: '2026-01-01' },
    createdAt: 1,
  }
}

describe('useSharedWithYou', () => {
  it('includes every shared moment when none are hidden', async () => {
    mockGetSharedMomentsForParticipant.mockResolvedValue([moment('m1'), moment('m2')])
    const { result } = renderHook(() => useSharedWithYou('me'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(2)
  })

  it('filters out a moment the participant has locally hidden', async () => {
    mockGetSharedMomentsForParticipant.mockResolvedValue([moment('m1'), moment('m2')])
    hideSharedMomentForUser('me', 'm1')

    const { result } = renderHook(() => useSharedWithYou('me'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]).toMatchObject({ kind: 'shared-moment', moment: { id: 'm2' } })
  })
})
