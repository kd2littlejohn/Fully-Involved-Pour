import { describe, expect, it, vi } from 'vitest'

vi.mock('../devMode', () => ({ isMockAuthEnabled: () => true }))

import {
  completeBlind,
  createBlindRoom,
  deleteBlindRoom,
  getAllFinalRankings,
  getAllParticipantComparisons,
  getAllParticipantResponses,
  getBlindRoom,
  getBlindRoomByCode,
  getBlindRoomSecrets,
  getBottleBlindHistory,
  getComparisons,
  getFinalRanking,
  getMyBlindRooms,
  getParticipant,
  getParticipants,
  getTastingResponses,
  joinBlindRoomByCode,
  lockFinalRanking,
  lockTastingResponse,
  markTastingCompleted,
  markTastingStarted,
  revealBlind,
  saveComparison,
  saveFinalRanking,
  saveTastingResponse,
  setParticipantReady,
  startBlind,
  type CreateBlindRoomInput,
} from './blindRoom'
import type { BlindSecretPour } from '../types'

const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/

function baseInput(overrides: Partial<CreateBlindRoomInput> = {}): CreateBlindRoomInput {
  const pours: BlindSecretPour[] = [
    { label: 'A', bottleId: 'b1', bottleName: 'Stagg Jr.' },
    { label: 'B', bottleId: 'b2', bottleName: 'Eagle Rare' },
    { label: 'C', bottleId: 'b3', bottleName: 'Elijah Craig Barrel Proof' },
  ]
  return {
    hostUid: 'host-1',
    hostUsername: 'kevin',
    sessionType: 'live',
    knowledgeMode: 'single',
    pourCount: 3,
    knownLineup: pours.map((p) => p.bottleName),
    pours,
    ...overrides,
  }
}

describe('createBlindRoom', () => {
  it('creates a room with a well-formed code, a ready host participant, and stored secrets', async () => {
    const room = await createBlindRoom(baseInput())

    expect(room.code).toMatch(CODE_PATTERN)
    expect(room.hostUid).toBe('host-1')
    expect(room.state).toBe('lobby')
    expect(room.participantCount).toBe(1)

    const participant = await getParticipant(room.id, 'host-1')
    expect(participant).toMatchObject({ uid: 'host-1', isHost: true, status: 'ready' })

    const secrets = await getBlindRoomSecrets(room.id)
    expect(secrets?.pours).toHaveLength(3)
    expect(secrets?.pours[0]).toMatchObject({ label: 'A', bottleName: 'Stagg Jr.' })
  })

  it('starts a solo room already active, with no one else to wait for', async () => {
    const room = await createBlindRoom(baseInput({ sessionType: 'solo', hostUid: 'solo-host', hostUsername: 'solo' }))

    expect(room.state).toBe('active')
    expect(room.startedAt).toBeDefined()

    const participant = await getParticipant(room.id, 'solo-host')
    expect(participant).toMatchObject({ uid: 'solo-host', isHost: true, status: 'ready' })
  })

  it('shuffles the known lineup for Single Blind so array position never matches the hidden A/B/C order', async () => {
    // Not a strong statistical claim — just confirms the room stores the
    // same set of names (shuffling is best-effort, not testable for order).
    const room = await createBlindRoom(baseInput())
    expect(room.knownLineup?.slice().sort()).toEqual(['Eagle Rare', 'Elijah Craig Barrel Proof', 'Stagg Jr.'].sort())
  })

  it('omits knownLineup entirely for Double Blind', async () => {
    const room = await createBlindRoom(baseInput({ knowledgeMode: 'double', knownLineup: undefined }))
    expect(room.knownLineup).toBeUndefined()
  })

  it('stores a deadline only for Blind Challenge sessions', async () => {
    const deadline = Date.now() + 86400000
    const challenge = await createBlindRoom(baseInput({ sessionType: 'challenge', deadline }))
    expect(challenge.deadline).toBe(deadline)

    const live = await createBlindRoom(baseInput({ sessionType: 'live', deadline }))
    expect(live.deadline).toBeUndefined()
  })

  it('falls back to an auto-generated name when none is given', async () => {
    const room = await createBlindRoom(baseInput({ name: undefined }))
    expect(room.name.length).toBeGreaterThan(0)
  })
})

describe('getBlindRoomByCode', () => {
  it('resolves a room by its code, case-insensitively', async () => {
    const room = await createBlindRoom(baseInput())
    const found = await getBlindRoomByCode(room.code.toLowerCase())
    expect(found?.id).toBe(room.id)
  })

  it('returns undefined for an unknown code', async () => {
    expect(await getBlindRoomByCode('ZZZZZZ')).toBeUndefined()
  })
})

describe('joinBlindRoomByCode', () => {
  it('adds a new participant and increments the room’s participant count', async () => {
    const room = await createBlindRoom(baseInput())
    const joined = await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')

    expect(joined.participantCount).toBe(2)
    const participants = await getParticipants(room.id)
    expect(participants.map((p) => p.uid).sort()).toEqual(['guest-1', 'host-1'])

    const guest = await getParticipant(room.id, 'guest-1')
    expect(guest).toMatchObject({ uid: 'guest-1', username: 'marcus', isHost: false, status: 'joined' })
  })

  it('is idempotent — joining again with an existing participant does not duplicate them', async () => {
    const room = await createBlindRoom(baseInput())
    await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')
    const again = await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')

    expect(again.participantCount).toBe(2)
    const participants = await getParticipants(room.id)
    expect(participants.filter((p) => p.uid === 'guest-1')).toHaveLength(1)
  })

  it('throws a clear error for an invalid code', async () => {
    await expect(joinBlindRoomByCode('NOPE99', 'guest-1', 'marcus')).rejects.toThrow(/doesn.t match/)
  })
})

describe('setParticipantReady / startBlind', () => {
  it('toggles a participant’s readiness', async () => {
    const room = await createBlindRoom(baseInput())
    await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')

    await setParticipantReady(room.id, 'guest-1', true)
    expect((await getParticipant(room.id, 'guest-1'))?.status).toBe('ready')

    await setParticipantReady(room.id, 'guest-1', false)
    expect((await getParticipant(room.id, 'guest-1'))?.status).toBe('joined')
  })

  it('transitions the room to active and records startedAt', async () => {
    const room = await createBlindRoom(baseInput())
    await startBlind(room.id)
    const updated = await getBlindRoom(room.id)
    expect(updated?.state).toBe('active')
    expect(updated?.startedAt).toBeDefined()
  })
})

describe('tasting responses', () => {
  it('autosaves a response as in-progress and can be read back', async () => {
    const room = await createBlindRoom(baseInput())
    await saveTastingResponse(room.id, 'host-1', 'A', { reaction: 'Love It', fipScore: 9.1 })

    const responses = await getTastingResponses(room.id, 'host-1')
    expect(responses).toHaveLength(1)
    expect(responses[0]).toMatchObject({ pourLabel: 'A', reaction: 'Love It', fipScore: 9.1, status: 'in-progress' })
  })

  it('locking a response marks it locked with a lockedAt timestamp', async () => {
    const room = await createBlindRoom(baseInput())
    await saveTastingResponse(room.id, 'host-1', 'A', { reaction: 'Love It', fipScore: 9.1 })
    await lockTastingResponse(room.id, 'host-1', 'A')

    const [response] = await getTastingResponses(room.id, 'host-1')
    expect(response).toMatchObject({ status: 'locked', reaction: 'Love It' })
    expect(response?.lockedAt).toBeDefined()
  })

  it('ignores further autosaves once a response is locked', async () => {
    const room = await createBlindRoom(baseInput())
    await saveTastingResponse(room.id, 'host-1', 'A', { reaction: 'Love It' })
    await lockTastingResponse(room.id, 'host-1', 'A')
    await saveTastingResponse(room.id, 'host-1', 'A', { reaction: 'Not For Me' })

    const [response] = await getTastingResponses(room.id, 'host-1')
    expect(response?.reaction).toBe('Love It')
  })

  it('keeps different participants’ responses in the same room separate', async () => {
    const room = await createBlindRoom(baseInput())
    await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')
    await saveTastingResponse(room.id, 'host-1', 'A', { reaction: 'Love It' })
    await saveTastingResponse(room.id, 'guest-1', 'A', { reaction: 'Just Okay' })

    expect((await getTastingResponses(room.id, 'host-1'))[0]?.reaction).toBe('Love It')
    expect((await getTastingResponses(room.id, 'guest-1'))[0]?.reaction).toBe('Just Okay')
  })
})

describe('markTastingStarted / markTastingCompleted', () => {
  it('moves a participant from ready to tasting', async () => {
    const room = await createBlindRoom(baseInput())
    await markTastingStarted(room.id, 'host-1')
    expect((await getParticipant(room.id, 'host-1'))?.status).toBe('tasting')
  })

  it('does not downgrade a participant who has already completed tasting', async () => {
    const room = await createBlindRoom(baseInput())
    await markTastingCompleted(room.id, 'host-1')
    await markTastingStarted(room.id, 'host-1')
    expect((await getParticipant(room.id, 'host-1'))?.status).toBe('completed')
  })

  it('marks a participant completed with a timestamp', async () => {
    const room = await createBlindRoom(baseInput())
    await markTastingCompleted(room.id, 'host-1')
    const participant = await getParticipant(room.id, 'host-1')
    expect(participant?.status).toBe('completed')
    expect(participant?.completedAt).toBeDefined()
  })
})

describe('final ranking', () => {
  it('autosaves a ranking as in-progress and can be read back', async () => {
    const room = await createBlindRoom(baseInput())
    await saveFinalRanking(room.id, 'host-1', ['B', 'A', 'C'])

    const ranking = await getFinalRanking(room.id, 'host-1')
    expect(ranking).toMatchObject({ order: ['B', 'A', 'C'], status: 'in-progress' })
  })

  it('locking a ranking marks it locked with a lockedAt timestamp', async () => {
    const room = await createBlindRoom(baseInput())
    await saveFinalRanking(room.id, 'host-1', ['B', 'A', 'C'])
    await lockFinalRanking(room.id, 'host-1', ['B', 'A', 'C'])

    const ranking = await getFinalRanking(room.id, 'host-1')
    expect(ranking).toMatchObject({ order: ['B', 'A', 'C'], status: 'locked' })
    expect(ranking?.lockedAt).toBeDefined()
  })

  it('ignores further autosaves once a ranking is locked', async () => {
    const room = await createBlindRoom(baseInput())
    await lockFinalRanking(room.id, 'host-1', ['B', 'A', 'C'])
    await saveFinalRanking(room.id, 'host-1', ['A', 'B', 'C'])

    const ranking = await getFinalRanking(room.id, 'host-1')
    expect(ranking?.order).toEqual(['B', 'A', 'C'])
  })

  it('keeps different participants’ rankings in the same room separate', async () => {
    const room = await createBlindRoom(baseInput())
    await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')
    await lockFinalRanking(room.id, 'host-1', ['A', 'B', 'C'])
    await lockFinalRanking(room.id, 'guest-1', ['C', 'B', 'A'])

    expect((await getFinalRanking(room.id, 'host-1'))?.order).toEqual(['A', 'B', 'C'])
    expect((await getFinalRanking(room.id, 'guest-1'))?.order).toEqual(['C', 'B', 'A'])
  })
})

describe('comparisons', () => {
  it('saves and reads back a comparison', async () => {
    const room = await createBlindRoom(baseInput())
    await saveComparison(room.id, 'host-1', {
      id: 'A-B',
      pairLabels: ['A', 'B'],
      winnerLabel: 'B',
      reason: 'better-flavor',
      updatedAt: Date.now(),
    })

    const comparisons = await getComparisons(room.id, 'host-1')
    expect(comparisons).toHaveLength(1)
    expect(comparisons[0]).toMatchObject({ id: 'A-B', winnerLabel: 'B', reason: 'better-flavor' })
  })

  it('keeps different participants’ comparisons in the same room separate', async () => {
    const room = await createBlindRoom(baseInput())
    await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')
    await saveComparison(room.id, 'host-1', { id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'B', updatedAt: Date.now() })
    await saveComparison(room.id, 'guest-1', { id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'A', updatedAt: Date.now() })

    expect((await getComparisons(room.id, 'host-1'))[0]?.winnerLabel).toBe('B')
    expect((await getComparisons(room.id, 'guest-1'))[0]?.winnerLabel).toBe('A')
  })

  it('fetches every named participant’s comparisons, keyed by uid', async () => {
    const room = await createBlindRoom(baseInput())
    await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')
    await saveComparison(room.id, 'host-1', { id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'B', updatedAt: Date.now() })

    const all = await getAllParticipantComparisons(room.id, ['host-1', 'guest-1'])
    expect(all['host-1']?.[0]?.winnerLabel).toBe('B')
    expect(all['guest-1']).toEqual([])
  })
})

describe('revealBlind', () => {
  it('transitions the room to revealed and records revealedAt', async () => {
    const room = await createBlindRoom(baseInput())
    await revealBlind(room.id)
    const updated = await getBlindRoom(room.id)
    expect(updated?.state).toBe('revealed')
    expect(updated?.revealedAt).toBeDefined()
  })
})

describe('completeBlind', () => {
  it('transitions the room to completed and records completedAt', async () => {
    const room = await createBlindRoom(baseInput())
    await revealBlind(room.id)
    await completeBlind(room.id)
    const updated = await getBlindRoom(room.id)
    expect(updated?.state).toBe('completed')
    expect(updated?.completedAt).toBeDefined()
  })

  it('is safe to call more than once — same field, no duplicate record', async () => {
    const room = await createBlindRoom(baseInput())
    await completeBlind(room.id)
    await completeBlind(room.id)
    const updated = await getBlindRoom(room.id)
    expect(updated?.state).toBe('completed')
  })
})

describe('deleteBlindRoom', () => {
  it('removes the room, its code, and every participant’s data', async () => {
    const room = await createBlindRoom(baseInput())
    await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')
    await saveTastingResponse(room.id, 'host-1', 'A', { reaction: 'Love It' })
    await saveComparison(room.id, 'host-1', {
      id: 'A-B',
      pairLabels: ['A', 'B'],
      winnerLabel: 'A',
      reason: 'less-heat',
      updatedAt: Date.now(),
    })
    await lockFinalRanking(room.id, 'host-1', ['A', 'B', 'C'])

    await deleteBlindRoom(room.id)

    expect(await getBlindRoom(room.id)).toBeUndefined()
    expect(await getBlindRoomByCode(room.code)).toBeUndefined()
    expect(await getParticipants(room.id)).toEqual([])
    expect(await getBlindRoomSecrets(room.id)).toBeUndefined()
    expect(await getTastingResponses(room.id, 'host-1')).toEqual([])
    expect(await getComparisons(room.id, 'host-1')).toEqual([])
    expect(await getFinalRanking(room.id, 'host-1')).toBeUndefined()
  })

  it('no longer shows up in getMyBlindRooms for the host', async () => {
    const room = await createBlindRoom(baseInput())
    await deleteBlindRoom(room.id)
    const rooms = await getMyBlindRooms('host-1')
    expect(rooms.find((r) => r.room.id === room.id)).toBeUndefined()
  })
})

describe('getAllParticipantResponses / getAllFinalRankings', () => {
  it('fetches every named participant’s responses and rankings, keyed by uid', async () => {
    const room = await createBlindRoom(baseInput())
    await joinBlindRoomByCode(room.code, 'guest-1', 'marcus')
    await saveTastingResponse(room.id, 'host-1', 'A', { reaction: 'Love It' })
    await saveTastingResponse(room.id, 'guest-1', 'A', { reaction: 'Just Okay' })
    await lockFinalRanking(room.id, 'host-1', ['A', 'B', 'C'])

    const responses = await getAllParticipantResponses(room.id, ['host-1', 'guest-1'])
    expect(responses['host-1']?.[0]?.reaction).toBe('Love It')
    expect(responses['guest-1']?.[0]?.reaction).toBe('Just Okay')

    const rankings = await getAllFinalRankings(room.id, ['host-1', 'guest-1'])
    expect(rankings['host-1']?.order).toEqual(['A', 'B', 'C'])
    expect(rankings['guest-1']).toBeUndefined()
  })
})

describe('getBottleBlindHistory', () => {
  it('finds a revealed room whose flight included this bottle, with the matching pour and this user’s own response', async () => {
    const room = await createBlindRoom(baseInput({ hostUid: 'blind-history-1', hostUsername: 'h1' }))
    await saveTastingResponse(room.id, 'blind-history-1', 'B', { reaction: 'Love It', fipScore: 9.2 })
    await revealBlind(room.id)

    const history = await getBottleBlindHistory('blind-history-1', 'b2')
    expect(history).toHaveLength(1)
    expect(history[0]?.room.id).toBe(room.id)
    expect(history[0]?.pour).toMatchObject({ label: 'B', bottleId: 'b2', bottleName: 'Eagle Rare' })
    expect(history[0]?.myResponse).toMatchObject({ reaction: 'Love It', fipScore: 9.2 })
  })

  it('excludes rooms that have not been revealed yet, even if the bottle is in the flight', async () => {
    await createBlindRoom(baseInput({ hostUid: 'blind-history-2', hostUsername: 'h2' }))
    const history = await getBottleBlindHistory('blind-history-2', 'b1')
    expect(history).toEqual([])
  })

  it('still includes a room once the host has finished it (completed, not just revealed)', async () => {
    const room = await createBlindRoom(baseInput({ hostUid: 'blind-history-5', hostUsername: 'h5' }))
    await revealBlind(room.id)
    await completeBlind(room.id)

    const history = await getBottleBlindHistory('blind-history-5', 'b2')
    expect(history).toHaveLength(1)
    expect(history[0]?.room.id).toBe(room.id)
  })

  it('excludes rooms whose flight never included this bottle', async () => {
    const room = await createBlindRoom(baseInput({ hostUid: 'blind-history-3', hostUsername: 'h3' }))
    await revealBlind(room.id)
    const history = await getBottleBlindHistory('blind-history-3', 'not-in-this-flight')
    expect(history).toEqual([])
  })

  it('sorts multiple revealed entries newest-revealed first', async () => {
    const roomA = await createBlindRoom(baseInput({ hostUid: 'blind-history-4', hostUsername: 'h4' }))
    await revealBlind(roomA.id)
    await new Promise((resolve) => setTimeout(resolve, 2))
    const roomB = await createBlindRoom(baseInput({ hostUid: 'blind-history-4', hostUsername: 'h4' }))
    await revealBlind(roomB.id)

    const history = await getBottleBlindHistory('blind-history-4', 'b1')
    expect(history.map((h) => h.room.id)).toEqual([roomB.id, roomA.id])
  })
})

describe('getMyBlindRooms', () => {
  it('returns only rooms the given uid actually participates in', async () => {
    const roomA = await createBlindRoom(baseInput({ hostUid: 'user-a', hostUsername: 'alice' }))
    await createBlindRoom(baseInput({ hostUid: 'user-b', hostUsername: 'bob' }))
    await joinBlindRoomByCode(roomA.code, 'user-c', 'carl')

    const forA = await getMyBlindRooms('user-a')
    expect(forA.map(({ room }) => room.id)).toEqual([roomA.id])

    const forC = await getMyBlindRooms('user-c')
    expect(forC.map(({ room }) => room.id)).toEqual([roomA.id])
    expect(forC[0]?.participant.isHost).toBe(false)
  })
})
