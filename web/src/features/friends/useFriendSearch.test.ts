import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useFriendSearch } from './useFriendSearch'
import type { ProfileSearchResult } from '../../data/repositories/profile'

const mockSearchProfiles = vi.fn()
const mockGetFriendStatus = vi.fn()

vi.mock('../../data/repositories/profile', () => ({
  searchProfiles: (...args: unknown[]) => mockSearchProfiles(...args),
}))

vi.mock('../../data/repositories/relationships', () => ({
  getFriendStatus: (...args: unknown[]) => mockGetFriendStatus(...args),
}))

const KEVIN: ProfileSearchResult = {
  uid: 'kevin-uid',
  username: 'Pour_Teknique',
  displayName: 'Kevin Littlejohn',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetFriendStatus.mockResolvedValue('none')
})

describe('useFriendSearch', () => {
  it('does nothing until a viewer uid and a non-empty query are both present', () => {
    const { result } = renderHook(() => useFriendSearch(undefined))
    act(() => result.current.setQuery('kevin'))
    expect(mockSearchProfiles).not.toHaveBeenCalled()
  })

  it('debounces, then searches with the normalized-at-source-level raw query and the viewer uid', async () => {
    mockSearchProfiles.mockResolvedValue([KEVIN])
    const { result } = renderHook(() => useFriendSearch('viewer-uid'))

    act(() => result.current.setQuery('Kevin'))
    expect(mockSearchProfiles).not.toHaveBeenCalled() // debounced, not immediate

    await waitFor(() => expect(mockSearchProfiles).toHaveBeenCalledWith('Kevin', 'viewer-uid'))
    await waitFor(() => expect(result.current.results.map((r) => r.uid)).toEqual(['kevin-uid']))
  })

  it('attaches each result its friendship status', async () => {
    mockSearchProfiles.mockResolvedValue([KEVIN])
    mockGetFriendStatus.mockResolvedValue('friends')
    const { result } = renderHook(() => useFriendSearch('viewer-uid'))

    act(() => result.current.setQuery('kevin'))

    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(result.current.results[0]?.status).toBe('friends')
  })

  it('filters out results blocked in either direction', async () => {
    const other: ProfileSearchResult = { uid: 'blocked-uid', username: 'blocked_user', displayName: 'Blocked User' }
    mockSearchProfiles.mockResolvedValue([KEVIN, other])
    mockGetFriendStatus.mockImplementation(async (_viewer: string, uid: string) => (uid === 'blocked-uid' ? 'blocked' : 'none'))
    const { result } = renderHook(() => useFriendSearch('viewer-uid'))

    act(() => result.current.setQuery('kevin'))

    await waitFor(() => expect(result.current.results.map((r) => r.uid)).toEqual(['kevin-uid']))
  })

  it('filters out results the viewer is blocked by', async () => {
    const other: ProfileSearchResult = { uid: 'blocked-by-uid', username: 'blocker', displayName: 'Blocker' }
    mockSearchProfiles.mockResolvedValue([other])
    mockGetFriendStatus.mockResolvedValue('blocked_by')
    const { result } = renderHook(() => useFriendSearch('viewer-uid'))

    act(() => result.current.setQuery('anything'))

    await waitFor(() => expect(mockGetFriendStatus).toHaveBeenCalled())
    expect(result.current.results).toEqual([])
  })

  it('clears results when the query is cleared', async () => {
    mockSearchProfiles.mockResolvedValue([KEVIN])
    const { result } = renderHook(() => useFriendSearch('viewer-uid'))
    act(() => result.current.setQuery('kevin'))
    await waitFor(() => expect(result.current.results).toHaveLength(1))

    act(() => result.current.setQuery(''))

    await waitFor(() => expect(result.current.results).toEqual([]))
  })
})
