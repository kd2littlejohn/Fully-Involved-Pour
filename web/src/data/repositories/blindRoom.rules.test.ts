/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules')

let testEnv: RulesTestEnvironment

const HOST_UID = 'host-uid'
const PARTICIPANT_UID = 'participant-uid'
const OTHER_UID = 'other-uid'
const OUTSIDER_UID = 'outsider-uid'
const ROOM_ID = 'room-1'

function baseRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    code: 'OAK742',
    name: 'Friday Night Blind',
    hostUid: HOST_UID,
    hostUsername: 'kevin',
    sessionType: 'live',
    knowledgeMode: 'single',
    pourCount: 3,
    state: 'lobby',
    createdAt: Date.now(),
    participantCount: 1,
    ...overrides,
  }
}

async function seedRoom(overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID), baseRoom(overrides))
  })
}

async function seedHostParticipant() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', HOST_UID), {
      uid: HOST_UID,
      username: 'kevin',
      isHost: true,
      status: 'ready',
      joinedAt: Date.now(),
    })
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fip-rules-test',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('blindRooms/{roomId}', () => {
  it('an authenticated user can create a room as its own host', async () => {
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(setDoc(doc(host.firestore(), 'blindRooms', ROOM_ID), baseRoom()))
  })

  it('an unauthenticated user cannot create a room', async () => {
    const anon = testEnv.unauthenticatedContext()
    await assertFails(setDoc(doc(anon.firestore(), 'blindRooms', ROOM_ID), baseRoom()))
  })

  it('cannot create a room claiming someone else as host', async () => {
    const impersonator = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertFails(setDoc(doc(impersonator.firestore(), 'blindRooms', ROOM_ID), baseRoom({ hostUid: HOST_UID })))
  })

  it('any signed-in user (even a non-member) can read room config for the join preview', async () => {
    await seedRoom()
    const stranger = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertSucceeds(getDoc(doc(stranger.firestore(), 'blindRooms', ROOM_ID)))
  })

  it('the host can update the room (e.g. advance state)', async () => {
    await seedRoom()
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(updateDoc(doc(host.firestore(), 'blindRooms', ROOM_ID), { state: 'active' }))
  })

  it('a participant cannot change room state — only the host can', async () => {
    await seedRoom()
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(updateDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID), { state: 'active' }))
  })

  it('a participant cannot become host by rewriting hostUid', async () => {
    await seedRoom()
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(updateDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID), { hostUid: PARTICIPANT_UID }))
  })

  it('the host can delete the room', async () => {
    await seedRoom()
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(deleteDoc(doc(host.firestore(), 'blindRooms', ROOM_ID)))
  })

  it('a participant cannot delete the room', async () => {
    await seedRoom()
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(deleteDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID)))
  })

  it('a stranger cannot delete the room', async () => {
    await seedRoom()
    const stranger = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertFails(deleteDoc(doc(stranger.firestore(), 'blindRooms', ROOM_ID)))
  })
})

describe('blindRooms/{roomId}/participants/{uid}', () => {
  it('a user can join by creating their own participant doc', async () => {
    await seedRoom()
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(
      setDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      }),
    )
  })

  it('cannot create a participant doc for someone else', async () => {
    await seedRoom()
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      setDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', OTHER_UID), {
        uid: OTHER_UID,
        username: 'james',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      }),
    )
  })

  it('a participant can update their own readiness', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(
      updateDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        status: 'ready',
        readyAt: Date.now(),
      }),
    )
  })

  it('a participant cannot edit another participant’s record', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', OTHER_UID), {
        uid: OTHER_UID,
        username: 'james',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      updateDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', OTHER_UID), { status: 'ready' }),
    )
  })

  it('the host cannot edit a participant’s record either — only the participant themselves can', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', OTHER_UID), {
        uid: OTHER_UID,
        username: 'james',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertFails(
      updateDoc(doc(host.firestore(), 'blindRooms', ROOM_ID, 'participants', OTHER_UID), { status: 'ready' }),
    )
  })

  it('a non-member cannot read another participant’s record', async () => {
    await seedRoom()
    await seedHostParticipant()
    const stranger = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertFails(getDoc(doc(stranger.firestore(), 'blindRooms', ROOM_ID, 'participants', HOST_UID)))
  })

  it('a fellow participant can read another participant’s record (lobby roster)', async () => {
    await seedRoom()
    await seedHostParticipant()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(getDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', HOST_UID)))
  })

  it('the host can read any participant’s record', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(getDoc(doc(host.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID)))
  })

  it('a collection-group query for "my rooms" (Active Blinds) only returns the caller’s own participant docs', async () => {
    await seedRoom()
    await seedHostParticipant()
    await seedRoom({ id: 'room-2' })
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
      // A participant record in a different room, belonging to someone else —
      // must never come back for PARTICIPANT_UID's own "my rooms" query.
      await setDoc(doc(context.firestore(), 'blindRooms', 'room-2', 'participants', OTHER_UID), {
        uid: OTHER_UID,
        username: 'james',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    const myRooms = query(collectionGroup(participant.firestore(), 'participants'), where('uid', '==', PARTICIPANT_UID))
    const snapshot = await assertSucceeds(getDocs(myRooms))
    expect(snapshot.docs).toHaveLength(1)
    expect(snapshot.docs[0]?.id).toBe(PARTICIPANT_UID)
  })

  it('the host can delete a participant record (part of deleteBlindRoom)', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(deleteDoc(doc(host.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID)))
  })

  it('a participant cannot delete their own record — only the host can', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(deleteDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID)))
  })
})

describe('blindRooms/{roomId}/participants/{uid}/responses/{pourLabel}', () => {
  async function seedParticipant(uid: string, username: string) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', uid), {
        uid,
        username,
        isHost: uid === HOST_UID,
        status: 'tasting',
        joinedAt: Date.now(),
      })
    })
  }

  function response(overrides: Record<string, unknown> = {}) {
    return { pourLabel: 'A', reaction: 'Love It', fipScore: 9.1, status: 'in-progress', updatedAt: Date.now(), ...overrides }
  }

  it('a participant can write their own tasting response', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(
      setDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'), response()),
    )
  })

  it('a participant can read their own tasting response', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'), response())
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(getDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A')))
  })

  it('cannot write a tasting response under someone else’s participant path', async () => {
    await seedRoom()
    await seedParticipant(OTHER_UID, 'james')
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      setDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', OTHER_UID, 'responses', 'A'), response()),
    )
  })

  it('another participant cannot read this participant’s tasting response', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await seedParticipant(OTHER_UID, 'james')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'), response())
    })
    const other = testEnv.authenticatedContext(OTHER_UID)
    await assertFails(getDoc(doc(other.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A')))
  })

  it('the host cannot read a participant’s tasting response before reveal either', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'), response())
    })
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertFails(getDoc(doc(host.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A')))
  })

  it('a participant can update their own in-progress response', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'), response())
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(
      setDoc(
        doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'),
        response({ reaction: 'Interesting' }),
        { merge: true },
      ),
    )
  })

  it('once locked, even the owning participant cannot edit their response', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'),
        response({ status: 'locked', lockedAt: Date.now() }),
      )
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      setDoc(
        doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'),
        response({ reaction: 'Not For Me' }),
        { merge: true },
      ),
    )
  })

  it('a fellow participant CAN read another participant’s response once the room is revealed', async () => {
    await seedRoom({ state: 'revealed' })
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await seedParticipant(OTHER_UID, 'james')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'), response())
    })
    const other = testEnv.authenticatedContext(OTHER_UID)
    await assertSucceeds(getDoc(doc(other.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A')))
  })

  it('a non-member still cannot read a response after reveal', async () => {
    await seedRoom({ state: 'revealed' })
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A'), response())
    })
    const stranger = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertFails(getDoc(doc(stranger.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'responses', 'A')))
  })
})

describe('blindRooms/{roomId}/participants/{uid}/ranking/{rankingId}', () => {
  async function seedParticipant(uid: string, username: string) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', uid), {
        uid,
        username,
        isHost: uid === HOST_UID,
        status: 'completed',
        joinedAt: Date.now(),
      })
    })
  }

  function ranking(overrides: Record<string, unknown> = {}) {
    return { order: ['A', 'B', 'C'], status: 'in-progress', updatedAt: Date.now(), ...overrides }
  }

  it('a participant can write and read their own final ranking', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(
      setDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final'), ranking()),
    )
    await assertSucceeds(getDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final')))
  })

  it('cannot write a ranking under someone else’s participant path', async () => {
    await seedRoom()
    await seedParticipant(OTHER_UID, 'james')
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      setDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', OTHER_UID, 'ranking', 'final'), ranking()),
    )
  })

  it('another participant cannot read this ranking before reveal, and neither can the host', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await seedParticipant(OTHER_UID, 'james')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final'), ranking())
    })
    const other = testEnv.authenticatedContext(OTHER_UID)
    await assertFails(getDoc(doc(other.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final')))
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertFails(getDoc(doc(host.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final')))
  })

  it('once locked, even the owning participant cannot edit their ranking', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final'),
        ranking({ status: 'locked', lockedAt: Date.now() }),
      )
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      setDoc(
        doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final'),
        ranking({ order: ['C', 'B', 'A'] }),
        { merge: true },
      ),
    )
  })

  it('a fellow participant CAN read another participant’s ranking once the room is revealed', async () => {
    await seedRoom({ state: 'revealed' })
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await seedParticipant(OTHER_UID, 'james')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final'), ranking())
    })
    const other = testEnv.authenticatedContext(OTHER_UID)
    await assertSucceeds(getDoc(doc(other.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'ranking', 'final')))
  })
})

describe('blindRooms/{roomId}/participants/{uid}/comparisons/{comparisonId}', () => {
  async function seedParticipant(uid: string, username: string) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', uid), {
        uid,
        username,
        isHost: uid === HOST_UID,
        status: 'tasting',
        joinedAt: Date.now(),
      })
    })
  }

  function comparison(overrides: Record<string, unknown> = {}) {
    return { id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'A', reason: 'better-flavor', updatedAt: Date.now(), ...overrides }
  }

  it('a participant can write and read their own comparison', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(
      setDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'comparisons', 'A-B'), comparison()),
    )
    await assertSucceeds(
      getDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'comparisons', 'A-B')),
    )
  })

  it('cannot write a comparison under someone else’s participant path', async () => {
    await seedRoom()
    await seedParticipant(OTHER_UID, 'james')
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      setDoc(doc(participant.firestore(), 'blindRooms', ROOM_ID, 'participants', OTHER_UID, 'comparisons', 'A-B'), comparison()),
    )
  })

  it('another participant cannot read this comparison before reveal, and neither can the host', async () => {
    await seedRoom()
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await seedParticipant(OTHER_UID, 'james')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'comparisons', 'A-B'), comparison())
    })
    const other = testEnv.authenticatedContext(OTHER_UID)
    await assertFails(getDoc(doc(other.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'comparisons', 'A-B')))
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertFails(getDoc(doc(host.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'comparisons', 'A-B')))
  })

  it('a fellow participant CAN read another participant’s comparison once the room is revealed', async () => {
    await seedRoom({ state: 'revealed' })
    await seedParticipant(PARTICIPANT_UID, 'marcus')
    await seedParticipant(OTHER_UID, 'james')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'comparisons', 'A-B'), comparison())
    })
    const other = testEnv.authenticatedContext(OTHER_UID)
    await assertSucceeds(getDoc(doc(other.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID, 'comparisons', 'A-B')))
  })
})

describe('blindRoomCodes/{code}', () => {
  it('the host of the referenced room can register its code', async () => {
    await seedRoom()
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(setDoc(doc(host.firestore(), 'blindRoomCodes', 'OAK742'), { roomId: ROOM_ID, createdAt: Date.now() }))
  })

  it('a non-host cannot register a code pointing at someone else’s room', async () => {
    await seedRoom()
    const impersonator = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertFails(
      setDoc(doc(impersonator.firestore(), 'blindRoomCodes', 'OAK742'), { roomId: ROOM_ID, createdAt: Date.now() }),
    )
  })

  it('anyone (even unauthenticated) can read a room code for the join flow', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRoomCodes', 'OAK742'), { roomId: ROOM_ID, createdAt: Date.now() })
    })
    const anon = testEnv.unauthenticatedContext()
    await assertSucceeds(getDoc(doc(anon.firestore(), 'blindRoomCodes', 'OAK742')))
  })

  it('the host of the referenced room can delete the code (part of deleteBlindRoom)', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRoomCodes', 'OAK742'), { roomId: ROOM_ID, createdAt: Date.now() })
    })
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(deleteDoc(doc(host.firestore(), 'blindRoomCodes', 'OAK742')))
  })

  it('a non-host cannot delete a code pointing at someone else’s room', async () => {
    await seedRoom()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRoomCodes', 'OAK742'), { roomId: ROOM_ID, createdAt: Date.now() })
    })
    const stranger = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertFails(deleteDoc(doc(stranger.firestore(), 'blindRoomCodes', 'OAK742')))
  })
})

describe('blindRoomSecrets/{roomId} — the actual blind-integrity boundary', () => {
  async function seedSecrets() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRoomSecrets', ROOM_ID), {
        roomId: ROOM_ID,
        pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Stagg Jr.' }],
      })
    })
  }

  it('the host can read the hidden bottle mapping', async () => {
    await seedRoom()
    await seedSecrets()
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(getDoc(doc(host.firestore(), 'blindRoomSecrets', ROOM_ID)))
  })

  it('a participant cannot read the hidden bottle mapping before reveal', async () => {
    await seedRoom()
    await seedSecrets()
    await seedHostParticipant()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'joined',
        joinedAt: Date.now(),
      })
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(getDoc(doc(participant.firestore(), 'blindRoomSecrets', ROOM_ID)))
  })

  it('a non-member cannot read the hidden bottle mapping', async () => {
    await seedRoom()
    await seedSecrets()
    const stranger = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertFails(getDoc(doc(stranger.firestore(), 'blindRoomSecrets', ROOM_ID)))
  })

  it('the host can write the hidden bottle mapping', async () => {
    await seedRoom()
    const host = testEnv.authenticatedContext(HOST_UID)
    await assertSucceeds(
      setDoc(doc(host.firestore(), 'blindRoomSecrets', ROOM_ID), {
        roomId: ROOM_ID,
        pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Stagg Jr.' }],
      }),
    )
  })

  it('a participant cannot write the hidden bottle mapping', async () => {
    await seedRoom()
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      setDoc(doc(participant.firestore(), 'blindRoomSecrets', ROOM_ID), {
        roomId: ROOM_ID,
        pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Stagg Jr.' }],
      }),
    )
  })

  it('a participant CAN read the hidden bottle mapping once the room is revealed', async () => {
    await seedRoom({ state: 'revealed' })
    await seedSecrets()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'completed',
        joinedAt: Date.now(),
      })
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertSucceeds(getDoc(doc(participant.firestore(), 'blindRoomSecrets', ROOM_ID)))
  })

  it('a non-member still cannot read the hidden bottle mapping after reveal', async () => {
    await seedRoom({ state: 'revealed' })
    await seedSecrets()
    const stranger = testEnv.authenticatedContext(OUTSIDER_UID)
    await assertFails(getDoc(doc(stranger.firestore(), 'blindRoomSecrets', ROOM_ID)))
  })

  it('a participant still cannot write the hidden bottle mapping even after reveal', async () => {
    await seedRoom({ state: 'revealed' })
    await seedSecrets()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'blindRooms', ROOM_ID, 'participants', PARTICIPANT_UID), {
        uid: PARTICIPANT_UID,
        username: 'marcus',
        isHost: false,
        status: 'completed',
        joinedAt: Date.now(),
      })
    })
    const participant = testEnv.authenticatedContext(PARTICIPANT_UID)
    await assertFails(
      setDoc(doc(participant.firestore(), 'blindRoomSecrets', ROOM_ID), {
        roomId: ROOM_ID,
        pours: [{ label: 'A', bottleId: 'b1', bottleName: 'Stagg Jr.' }],
      }),
    )
  })
})
