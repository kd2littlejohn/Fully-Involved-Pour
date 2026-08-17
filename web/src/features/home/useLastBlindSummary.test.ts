import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLastBlindSummary } from './useLastBlindSummary'
import type { BlindFinalRanking, BlindRoom, BlindRoomSecrets, BlindTastingResponse } from '../../data/types'

const mockGetMyBlindRooms = vi.fn()
const mockGetBlindRoomSecrets = vi.fn()
const mockGetFinalRanking = vi.fn()
const mockGetTastingResponses = vi.fn()

vi.mock('../../data/repositories/blindRoom', () => ({
  getMyBlindRooms: (...args: unknown[]) => mockGetMyBlindRooms(...args),
  getBlindRoomSecrets: (...args: unknown[]) => mockGetBlindRoomSecrets(...args),
  getFinalRanking: (...args: unknown[]) => mockGetFinalRanking(...args),
  getTastingResponses: (...args: unknown[]) => mockGetTastingResponses(...args),
}))

function room(overrides: Partial<BlindRoom> = {}): BlindRoom {
  return {
    id: 'room-1',
    code: 'ABC123',
    name: 'Double Oak Showdown',
    hostUid: 'host-1',
    hostUsername: 'host',
    sessionType: 'live',
    knowledgeMode: 'single',
    pourCount: 2,
    state: 'revealed',
    createdAt: 1,
    revealedAt: 100,
    participantCount: 2,
    ...overrides,
  }
}

describe('useLastBlindSummary', () => {
  it('returns undefined without loading forever when there is no uid', async () => {
    const { result } = renderHook(() => useLastBlindSummary(undefined))
    expect(result.current).toEqual({ summary: undefined, loading: false })
    expect(mockGetMyBlindRooms).not.toHaveBeenCalled()
  })

  it('returns undefined when the user has no finished blinds', async () => {
    mockGetMyBlindRooms.mockResolvedValueOnce([{ room: room({ state: 'lobby', revealedAt: undefined }), participant: {} }])

    const { result } = renderHook(() => useLastBlindSummary('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary).toBeUndefined()
    expect(mockGetBlindRoomSecrets).not.toHaveBeenCalled()
  })

  it('resolves the winning bottle name and score for the most recent finished room', async () => {
    const r = room({ state: 'completed', revealedAt: 100, completedAt: 200 })
    mockGetMyBlindRooms.mockResolvedValueOnce([{ room: r, participant: {} }])
    mockGetBlindRoomSecrets.mockResolvedValueOnce({
      roomId: r.id,
      pours: [
        { label: 'A', bottleId: 'b1', bottleName: 'Pursuit Double Oaked Rye', distillery: 'Pursuit' },
        { label: 'B', bottleId: 'b2', bottleName: 'Peerless' },
      ],
    } satisfies BlindRoomSecrets)
    mockGetFinalRanking.mockResolvedValueOnce({ order: ['A', 'B'], status: 'locked', updatedAt: 1 } satisfies BlindFinalRanking)
    mockGetTastingResponses.mockResolvedValueOnce([
      { pourLabel: 'A', fipScore: 9.3, status: 'locked', updatedAt: 1 },
      { pourLabel: 'B', fipScore: 7.1, status: 'locked', updatedAt: 1 },
    ] satisfies BlindTastingResponse[])

    const { result } = renderHook(() => useLastBlindSummary('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary).toEqual({
      room: r,
      winningBottleName: 'Pursuit Double Oaked Rye',
      winningDistillery: 'Pursuit',
      winningImageUrl: undefined,
      score: 9.3,
    })
  })

  it('picks the most recently finished room over older ones', async () => {
    const older = room({ id: 'older', state: 'revealed', revealedAt: 50 })
    const newer = room({ id: 'newer', state: 'completed', revealedAt: 100, completedAt: 300 })
    mockGetMyBlindRooms.mockResolvedValueOnce([
      { room: older, participant: {} },
      { room: newer, participant: {} },
    ])
    mockGetBlindRoomSecrets.mockResolvedValueOnce({
      roomId: newer.id,
      pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Weller Full Proof' }],
    } satisfies BlindRoomSecrets)
    mockGetFinalRanking.mockResolvedValueOnce({ order: ['A'], status: 'locked', updatedAt: 1 } satisfies BlindFinalRanking)
    mockGetTastingResponses.mockResolvedValueOnce([])

    const { result } = renderHook(() => useLastBlindSummary('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary?.room.id).toBe('newer')
    expect(mockGetBlindRoomSecrets).toHaveBeenCalledWith('newer')
  })

  it('returns undefined when there is no locked ranking to name a winner', async () => {
    const r = room({ state: 'revealed' })
    mockGetMyBlindRooms.mockResolvedValueOnce([{ room: r, participant: {} }])
    mockGetBlindRoomSecrets.mockResolvedValueOnce({ roomId: r.id, pours: [] } satisfies BlindRoomSecrets)
    mockGetFinalRanking.mockResolvedValueOnce(undefined)
    mockGetTastingResponses.mockResolvedValueOnce([])

    const { result } = renderHook(() => useLastBlindSummary('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary).toBeUndefined()
  })
})
