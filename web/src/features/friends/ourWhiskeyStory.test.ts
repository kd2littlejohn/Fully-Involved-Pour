import { describe, expect, it, vi } from 'vitest'

vi.mock('../../data/devMode', () => ({ isMockAuthEnabled: () => true }))

import { createSharedMoment } from '../../data/repositories/sharedMoments'
import { createBlindRoom, joinBlindRoomByCode } from '../../data/repositories/blindRoom'
import { buildOurWhiskeyStory } from './ourWhiskeyStory'

describe('buildOurWhiskeyStory', () => {
  it('reports zero pours together and no blind tastings when nothing has ever been shared', async () => {
    const story = await buildOurWhiskeyStory('viewer-empty', 'friend-empty')
    expect(story.poursTogetherCount).toBe(0)
    expect(story.blindTastingsTogetherCount).toBe(0)
    expect(story.mostSharedBottle).toBeUndefined()
  })

  it('counts SharedMoments in both directions (I shared with them, or they shared with me)', async () => {
    await createSharedMoment({
      storyId: 'p1',
      ownerId: 'viewer-a',
      ownerUsername: 'viewer',
      participantIds: ['friend-a'],
      snapshot: { bottleName: 'Stagg', date: '2026-01-01' },
    })
    await createSharedMoment({
      storyId: 'p2',
      ownerId: 'friend-a',
      ownerUsername: 'friend',
      participantIds: ['viewer-a'],
      snapshot: { bottleName: 'Weller 12', date: '2026-01-02' },
    })
    const story = await buildOurWhiskeyStory('viewer-a', 'friend-a')
    expect(story.poursTogetherCount).toBe(2)
  })

  it('never claims a "most shared" bottle from a single shared pour', async () => {
    await createSharedMoment({
      storyId: 'p3',
      ownerId: 'viewer-b',
      ownerUsername: 'viewer',
      participantIds: ['friend-b'],
      snapshot: { bottleName: 'Stagg', date: '2026-01-01' },
    })
    const story = await buildOurWhiskeyStory('viewer-b', 'friend-b')
    expect(story.mostSharedBottle).toBeUndefined()
  })

  it('surfaces a most-shared bottle once it has genuinely come up more than once', async () => {
    await createSharedMoment({
      storyId: 'p4',
      ownerId: 'viewer-c',
      ownerUsername: 'viewer',
      participantIds: ['friend-c'],
      snapshot: { bottleName: 'Stagg', date: '2026-01-01' },
    })
    await createSharedMoment({
      storyId: 'p5',
      ownerId: 'viewer-c',
      ownerUsername: 'viewer',
      participantIds: ['friend-c'],
      snapshot: { bottleName: 'Stagg', date: '2026-01-05' },
    })
    const story = await buildOurWhiskeyStory('viewer-c', 'friend-c')
    expect(story.mostSharedBottle).toEqual({ name: 'Stagg', count: 2 })
  })

  it('counts real blind tastings together via existing BlindRoom participant records', async () => {
    const room = await createBlindRoom({
      hostUid: 'viewer-d',
      hostUsername: 'viewer',
      sessionType: 'live',
      knowledgeMode: 'single',
      pourCount: 2,
      pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Bottle A' }],
    })
    await joinBlindRoomByCode(room.code, 'friend-d', 'friend')
    const story = await buildOurWhiskeyStory('viewer-d', 'friend-d')
    expect(story.blindTastingsTogetherCount).toBe(1)
  })

  it('ignores bottles or blinds shared with someone else entirely', async () => {
    await createSharedMoment({
      storyId: 'p6',
      ownerId: 'viewer-e',
      ownerUsername: 'viewer',
      participantIds: ['a-different-friend'],
      snapshot: { bottleName: 'Stagg', date: '2026-01-01' },
    })
    const story = await buildOurWhiskeyStory('viewer-e', 'friend-e')
    expect(story.poursTogetherCount).toBe(0)
  })
})
