import { describe, expect, it, vi } from 'vitest'

vi.mock('../devMode', () => ({ isMockAuthEnabled: () => true }))

import {
  acceptSharedMoment,
  addComment,
  createSharedMoment,
  deleteComment,
  deleteSharedMoment,
  deleteSharedMomentsForStory,
  getComments,
  getParticipantNotes,
  getReactions,
  getSharedMoment,
  getSharedMomentsForOwner,
  getSharedMomentsForParticipant,
  removeReaction,
  setParticipantNote,
  setReaction,
} from './sharedMoments'

function snapshot() {
  return { bottleName: 'Test Bottle', date: '2026-01-01' }
}

describe('createSharedMoment', () => {
  it('starts with no accepted participants and is visible to the owner and every tagged participant', async () => {
    const moment = await createSharedMoment({
      storyId: 'p1',
      ownerId: 'owner',
      ownerUsername: 'owner',
      participantIds: ['p1', 'p2'],
      snapshot: snapshot(),
    })
    expect(moment.acceptedParticipantIds).toEqual([])
    expect(await getSharedMomentsForOwner('owner')).toContainEqual(moment)
    expect((await getSharedMomentsForParticipant('p1')).map((m) => m.id)).toContain(moment.id)
    expect((await getSharedMomentsForParticipant('p2')).map((m) => m.id)).toContain(moment.id)
  })
})

describe('acceptSharedMoment', () => {
  it('adds the participant to acceptedParticipantIds without duplicating on repeat accepts', async () => {
    const moment = await createSharedMoment({
      storyId: 'p2',
      ownerId: 'owner2',
      ownerUsername: 'owner2',
      participantIds: ['friend1'],
      snapshot: snapshot(),
    })
    await acceptSharedMoment(moment.id, 'friend1')
    await acceptSharedMoment(moment.id, 'friend1')
    const reloaded = await getSharedMoment(moment.id)
    expect(reloaded?.acceptedParticipantIds).toEqual(['friend1'])
  })
})

describe('deleteSharedMoment', () => {
  it('removes the moment entirely', async () => {
    const moment = await createSharedMoment({
      storyId: 'p3',
      ownerId: 'owner3',
      ownerUsername: 'owner3',
      participantIds: [],
      snapshot: snapshot(),
    })
    await deleteSharedMoment(moment.id)
    expect(await getSharedMoment(moment.id)).toBeUndefined()
  })

  it('cascades to delete every comment and reaction on the moment, without touching unrelated ones', async () => {
    const moment = await createSharedMoment({
      storyId: 'p3b',
      ownerId: 'owner3b',
      ownerUsername: 'owner3b',
      participantIds: ['friendX'],
      snapshot: snapshot(),
    })
    const other = await createSharedMoment({
      storyId: 'p3c',
      ownerId: 'owner3b',
      ownerUsername: 'owner3b',
      participantIds: ['friendX'],
      snapshot: snapshot(),
    })
    await addComment({ sharedMomentId: moment.id, authorId: 'friendX', authorUsername: 'friendx', text: 'Nice.' })
    await addComment({ sharedMomentId: other.id, authorId: 'friendX', authorUsername: 'friendx', text: 'Also nice.' })
    await setReaction(moment.id, 'friendX', 'cheers')
    await setReaction(other.id, 'friendX', 'cheers')

    await deleteSharedMoment(moment.id)

    expect(await getComments(moment.id)).toEqual([])
    expect(await getReactions(moment.id)).toEqual([])
    expect((await getComments(other.id)).map((c) => c.text)).toEqual(['Also nice.'])
    expect(await getReactions(other.id)).toHaveLength(1)
  })
})

describe('deleteSharedMomentsForStory', () => {
  it('deletes only moments the given owner created for that story', async () => {
    const owned = await createSharedMoment({
      storyId: 'story-1',
      ownerId: 'owner4',
      ownerUsername: 'owner4',
      participantIds: [],
      snapshot: snapshot(),
    })
    const differentOwner = await createSharedMoment({
      storyId: 'story-1',
      ownerId: 'someone-else',
      ownerUsername: 'someone-else',
      participantIds: [],
      snapshot: snapshot(),
    })
    const differentStory = await createSharedMoment({
      storyId: 'story-2',
      ownerId: 'owner4',
      ownerUsername: 'owner4',
      participantIds: [],
      snapshot: snapshot(),
    })

    await deleteSharedMomentsForStory('story-1', 'owner4')

    expect(await getSharedMoment(owned.id)).toBeUndefined()
    expect(await getSharedMoment(differentOwner.id)).toBeDefined()
    expect(await getSharedMoment(differentStory.id)).toBeDefined()
  })

  it('never throws when there is nothing to delete', async () => {
    await expect(deleteSharedMomentsForStory('no-such-story', 'nobody')).resolves.toBeUndefined()
  })
})

describe('participant notes', () => {
  it('stores one note per participant, never touching the original story', async () => {
    await setParticipantNote('moment-x', 'friendA', 'Loved this one.')
    await setParticipantNote('moment-x', 'friendB', 'A bit hot for me.')
    const notes = await getParticipantNotes('moment-x')
    expect(notes).toHaveLength(2)
    expect(notes.find((n) => n.uid === 'friendA')?.note).toBe('Loved this one.')
  })
})

describe('reactions', () => {
  it('setting a reaction twice with a different type overwrites rather than stacking', async () => {
    await setReaction('moment-y', 'u1', 'cheers')
    await setReaction('moment-y', 'u1', 'great-pour')
    const reactions = await getReactions('moment-y')
    expect(reactions).toHaveLength(1)
    expect(reactions[0]?.type).toBe('great-pour')
  })

  it('removeReaction clears it entirely', async () => {
    await setReaction('moment-z', 'u2', 'cheers')
    await removeReaction('moment-z', 'u2')
    expect(await getReactions('moment-z')).toEqual([])
  })
})

describe('comments', () => {
  it('adds and deletes comments, sorted oldest first', async () => {
    const first = await addComment({ sharedMomentId: 'moment-c', authorId: 'a1', authorUsername: 'a1', text: 'First!' })
    await new Promise((resolve) => setTimeout(resolve, 2))
    await addComment({ sharedMomentId: 'moment-c', authorId: 'a2', authorUsername: 'a2', text: 'Agreed.' })
    const comments = await getComments('moment-c')
    expect(comments.map((c) => c.text)).toEqual(['First!', 'Agreed.'])

    await deleteComment(first.id)
    expect((await getComments('moment-c')).map((c) => c.text)).toEqual(['Agreed.'])
  })
})
