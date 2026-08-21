import { describe, expect, it, vi } from 'vitest'

vi.mock('../../data/devMode', () => ({ isMockAuthEnabled: () => true }))

import { renderHook, waitFor } from '@testing-library/react'
import { createBlindRoom, joinBlindRoomByCode, completeBlind, revealBlind } from '../../data/repositories/blindRoom'
import { useSharedBlindActivity } from './useSharedBlindActivity'
import type { FriendProfile } from './useFriends'

function friend(overrides: Partial<FriendProfile> & Pick<FriendProfile, 'uid'>): FriendProfile {
  return { username: overrides.uid, ...overrides }
}

describe('useSharedBlindActivity', () => {
  it('reports nothing when the viewer has no completed rooms', async () => {
    const { result } = renderHook(() => useSharedBlindActivity('viewer-empty', [friend({ uid: 'friend-empty' })]))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
  })

  it('surfaces a real completed Blind Room the friend also participated in, with the room name and a real timestamp', async () => {
    const room = await createBlindRoom({
      hostUid: 'viewer-a',
      hostUsername: 'viewer',
      name: 'Double Oak Showdown',
      sessionType: 'live',
      knowledgeMode: 'single',
      pourCount: 2,
      pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Bottle A' }],
    })
    await joinBlindRoomByCode(room.code, 'friend-a', 'friend')
    await revealBlind(room.id)
    await completeBlind(room.id)

    const dre = friend({ uid: 'friend-a', displayName: 'Dre', username: 'dre' })
    const { result } = renderHook(() => useSharedBlindActivity('viewer-a', [dre]))
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    const item = result.current.items[0]
    expect(item?.text).toBe('You and Dre completed a Blind Room')
    expect(item?.subtitle).toBe('Double Oak Showdown')
    expect(item?.to).toBe(`/blind/${room.id}/reveal`)
    expect(item?.actorName).toBe('Dre')
    expect(typeof item?.timestamp).toBe('number')
  })

  it('ignores a room the friend never joined', async () => {
    const room = await createBlindRoom({
      hostUid: 'viewer-b',
      hostUsername: 'viewer',
      sessionType: 'live',
      knowledgeMode: 'single',
      pourCount: 2,
      pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Bottle A' }],
    })
    await revealBlind(room.id)
    await completeBlind(room.id)

    const { result } = renderHook(() => useSharedBlindActivity('viewer-b', [friend({ uid: 'a-different-friend' })]))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
  })

  it('ignores a room that has not been completed yet', async () => {
    const room = await createBlindRoom({
      hostUid: 'viewer-c',
      hostUsername: 'viewer',
      sessionType: 'live',
      knowledgeMode: 'single',
      pourCount: 2,
      pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Bottle A' }],
    })
    await joinBlindRoomByCode(room.code, 'friend-c', 'friend')
    // Deliberately never revealed/completed.

    const { result } = renderHook(() => useSharedBlindActivity('viewer-c', [friend({ uid: 'friend-c' })]))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
  })
})
