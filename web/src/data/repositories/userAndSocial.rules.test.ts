/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, endAt, getDoc, getDocs, orderBy, query, setDoc, startAt, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules')

let testEnv: RulesTestEnvironment

const USER_A = 'user-a'
const USER_B = 'user-b'
const OUTSIDER = 'outsider'

function baseUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    bottles: [{ id: 'b1', name: 'Eagle Rare 10 Year', status: 'sealed', createdAt: 1 }],
    pours: [{ id: 'p1', bottleId: 'b1', date: '2026-01-01', rating: 8.6, notes: 'Great porch pour with Dad.' }],
    memories: [],
    infinityBottles: [],
    customLibrary: [],
    ...overrides,
  }
}

async function seedUserDoc(uid: string, overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid), baseUserDoc(overrides))
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fip-rules-test-social',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

// --- users/{uid} — the core private-journal doc: bottles, pours, journey,
// notes, favorites, purchase details all live here. -------------------------
describe('users/{uid}', () => {
  it('the owner can read their own document', async () => {
    await seedUserDoc(USER_A)
    const a = testEnv.authenticatedContext(USER_A)
    await assertSucceeds(getDoc(doc(a.firestore(), 'users', USER_A)))
  })

  it('the owner can write their own document', async () => {
    const a = testEnv.authenticatedContext(USER_A)
    await assertSucceeds(setDoc(doc(a.firestore(), 'users', USER_A), baseUserDoc()))
  })

  it('User A cannot read User B’s private bottle/pour/journey/notes document', async () => {
    await seedUserDoc(USER_B)
    const a = testEnv.authenticatedContext(USER_A)
    await assertFails(getDoc(doc(a.firestore(), 'users', USER_B)))
  })

  it('User A cannot modify User B’s pours (or any field on B’s document)', async () => {
    await seedUserDoc(USER_B)
    const a = testEnv.authenticatedContext(USER_A)
    await assertFails(updateDoc(doc(a.firestore(), 'users', USER_B), { pours: [] }))
    await assertFails(setDoc(doc(a.firestore(), 'users', USER_B), baseUserDoc(), { merge: true }))
  })

  it('a direct document access attempt by an unauthenticated client is denied', async () => {
    await seedUserDoc(USER_A)
    const anon = testEnv.unauthenticatedContext()
    await assertFails(getDoc(doc(anon.firestore(), 'users', USER_A)))
    await assertFails(setDoc(doc(anon.firestore(), 'users', USER_A), baseUserDoc()))
  })
})

// --- profiles/{uid} — public projection, owner-only write. ------------------
describe('profiles/{uid}', () => {
  it('is publicly readable, including unauthenticated', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'profiles', USER_A), { username: 'kevin', displayName: 'Kevin' })
    })
    const anon = testEnv.unauthenticatedContext()
    await assertSucceeds(getDoc(doc(anon.firestore(), 'profiles', USER_A)))
  })

  it('only the owner can write their own profile', async () => {
    const a = testEnv.authenticatedContext(USER_A)
    await assertSucceeds(setDoc(doc(a.firestore(), 'profiles', USER_A), { username: 'kevin' }))

    const b = testEnv.authenticatedContext(USER_B)
    await assertFails(setDoc(doc(b.firestore(), 'profiles', USER_A), { username: 'hijacked' }))
  })

  // Friend Search's actual query shape (searchProfiles in
  // data/repositories/profile.ts) — a prefix-range LIST, not just a
  // single-doc get. Collection-group queries need their own dedicated rule
  // to be provable (see the long comment in firestore.rules), but this is a
  // plain single-collection query under an unconditional `allow read: if
  // true`, so it's provable and should just work — this test exists to
  // confirm that in practice, not just in theory.
  it('an authenticated user can run the prefix-range search query and find another user by normalized username or display name', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'profiles', USER_A), {
        username: 'Pour_Teknique',
        normalizedUsername: 'pour_teknique',
        displayName: 'Kevin Littlejohn',
        normalizedDisplayName: 'kevin littlejohn',
      })
    })
    const b = testEnv.authenticatedContext(USER_B)

    const byUsername = await getDocs(
      query(collection(b.firestore(), 'profiles'), orderBy('normalizedUsername'), startAt('pour_tek'), endAt('pour_tek')),
    )
    expect(byUsername.docs.map((d) => d.id)).toEqual([USER_A])

    const byDisplayName = await getDocs(
      query(collection(b.firestore(), 'profiles'), orderBy('normalizedDisplayName'), startAt('kevin'), endAt('kevin')),
    )
    expect(byDisplayName.docs.map((d) => d.id)).toEqual([USER_A])
  })

  it('the prefix-range search query does not require signing in (matches the deliberate public-profile-preview design)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'profiles', USER_A), {
        username: 'kevin',
        normalizedUsername: 'kevin',
        displayName: 'Kevin',
        normalizedDisplayName: 'kevin',
      })
    })
    const anon = testEnv.unauthenticatedContext()
    const results = await getDocs(
      query(collection(anon.firestore(), 'profiles'), orderBy('normalizedUsername'), startAt('kevin'), endAt('kevin')),
    )
    expect(results.docs.map((d) => d.id)).toEqual([USER_A])
  })
})

// --- usernames/{username} — uniqueness registry. ----------------------------
describe('usernames/{username}', () => {
  it('cannot be claimed on behalf of a different uid', async () => {
    const a = testEnv.authenticatedContext(USER_A)
    await assertFails(setDoc(doc(a.firestore(), 'usernames', 'kevin'), { uid: USER_B }))
  })

  it('cannot be taken over once claimed by someone else', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'usernames', 'kevin'), { uid: USER_A })
    })
    const b = testEnv.authenticatedContext(USER_B)
    await assertFails(setDoc(doc(b.firestore(), 'usernames', 'kevin'), { uid: USER_B }))
  })
})

// --- relationships/{pairId} — friendship is a shared feature: accessible
// only to the two involved users, never a global collection. ---------------
describe('relationships/{pairId}', () => {
  const pairId = [USER_A, USER_B].sort().join('_')

  it('is readable by either involved user', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'relationships', pairId), {
        userIds: [USER_A, USER_B],
        status: 'friends',
        requestedBy: USER_A,
      })
    })
    const a = testEnv.authenticatedContext(USER_A)
    const b = testEnv.authenticatedContext(USER_B)
    await assertSucceeds(getDoc(doc(a.firestore(), 'relationships', pairId)))
    await assertSucceeds(getDoc(doc(b.firestore(), 'relationships', pairId)))
  })

  it('is not readable by an uninvolved outsider', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'relationships', pairId), {
        userIds: [USER_A, USER_B],
        status: 'friends',
        requestedBy: USER_A,
      })
    })
    const outsider = testEnv.authenticatedContext(OUTSIDER)
    await assertFails(getDoc(doc(outsider.firestore(), 'relationships', pairId)))
  })

  it('accepting a friend request requires a real pending request from the named sender', async () => {
    const requestId = `${USER_A}_${USER_B}`
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'friendRequests', requestId), {
        senderId: USER_A,
        receiverId: USER_B,
        status: 'pending',
      })
    })
    const b = testEnv.authenticatedContext(USER_B)
    await assertSucceeds(
      setDoc(doc(b.firestore(), 'relationships', pairId), { userIds: [USER_A, USER_B], status: 'friends', requestedBy: USER_A }),
    )
  })

  it('cannot fabricate a friendship with no pending request behind it', async () => {
    const a = testEnv.authenticatedContext(USER_A)
    await assertFails(
      setDoc(doc(a.firestore(), 'relationships', pairId), { userIds: [USER_A, USER_B], status: 'friends', requestedBy: USER_A }),
    )
  })

  // This is the actual bug that broke Friend Search end to end: with no
  // !exists() branch, reading a relationship doc that doesn't exist yet
  // (the normal case — you're searching for someone you've never
  // interacted with) threw permission-denied instead of succeeding with
  // "not found," which broke getFriendStatus for every search result
  // against a stranger.
  it('a get on a relationship that does not exist yet succeeds (not permission-denied), so getFriendStatus can resolve "none"', async () => {
    const a = testEnv.authenticatedContext(USER_A)
    const snap = await assertSucceeds(getDoc(doc(a.firestore(), 'relationships', pairId)))
    expect(snap.exists()).toBe(false)
  })
})

// --- friendRequests/{senderId}_{receiverId} ---------------------------------
describe('friendRequests/{requestId}', () => {
  const requestId = `${USER_A}_${USER_B}`

  it('is readable only by the sender or receiver, not an outsider', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'friendRequests', requestId), { senderId: USER_A, receiverId: USER_B, status: 'pending' })
    })
    const a = testEnv.authenticatedContext(USER_A)
    const b = testEnv.authenticatedContext(USER_B)
    const outsider = testEnv.authenticatedContext(OUTSIDER)
    await assertSucceeds(getDoc(doc(a.firestore(), 'friendRequests', requestId)))
    await assertSucceeds(getDoc(doc(b.firestore(), 'friendRequests', requestId)))
    await assertFails(getDoc(doc(outsider.firestore(), 'friendRequests', requestId)))
  })

  it('only the sender can create a request in their own name', async () => {
    const impersonator = testEnv.authenticatedContext(OUTSIDER)
    await assertFails(
      setDoc(doc(impersonator.firestore(), 'friendRequests', requestId), { senderId: USER_A, receiverId: USER_B, status: 'pending' }),
    )
  })

  it('only the receiver can accept; the sender cannot accept their own request', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'friendRequests', requestId), { senderId: USER_A, receiverId: USER_B, status: 'pending' })
    })
    const a = testEnv.authenticatedContext(USER_A)
    await assertFails(updateDoc(doc(a.firestore(), 'friendRequests', requestId), { status: 'accepted' }))

    const b = testEnv.authenticatedContext(USER_B)
    await assertSucceeds(updateDoc(doc(b.firestore(), 'friendRequests', requestId), { status: 'accepted' }))
  })

  // Same !exists() bug as relationships/{pairId} above — getFriendStatus
  // does two of these (outgoing and incoming direction) per search result.
  it('a get on a friend request that does not exist yet succeeds (not permission-denied)', async () => {
    const a = testEnv.authenticatedContext(USER_A)
    const snap = await assertSucceeds(getDoc(doc(a.firestore(), 'friendRequests', requestId)))
    expect(snap.exists()).toBe(false)
  })
})

// --- recommendations/{id} — sender and recipient can access; no one else. --
describe('recommendations/{id}', () => {
  it('is readable only by the sender or recipient', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'recommendations', 'rec-1'), {
        senderId: USER_A,
        recipientId: USER_B,
        status: 'pending',
        bottleName: 'Eagle Rare',
      })
    })
    const a = testEnv.authenticatedContext(USER_A)
    const b = testEnv.authenticatedContext(USER_B)
    const outsider = testEnv.authenticatedContext(OUTSIDER)
    await assertSucceeds(getDoc(doc(a.firestore(), 'recommendations', 'rec-1')))
    await assertSucceeds(getDoc(doc(b.firestore(), 'recommendations', 'rec-1')))
    await assertFails(getDoc(doc(outsider.firestore(), 'recommendations', 'rec-1')))
  })

  it('only the recipient can change status, and only the status field', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'recommendations', 'rec-1'), {
        senderId: USER_A,
        recipientId: USER_B,
        status: 'pending',
        bottleName: 'Eagle Rare',
      })
    })
    const a = testEnv.authenticatedContext(USER_A)
    await assertFails(updateDoc(doc(a.firestore(), 'recommendations', 'rec-1'), { status: 'added-to-wishlist' }))

    const b = testEnv.authenticatedContext(USER_B)
    await assertSucceeds(updateDoc(doc(b.firestore(), 'recommendations', 'rec-1'), { status: 'added-to-wishlist' }))
    await assertFails(updateDoc(doc(b.firestore(), 'recommendations', 'rec-1'), { bottleName: 'Hijacked' }))
  })
})

// --- notifications/{id} — recipient-only read/update. -----------------------
describe('notifications/{id}', () => {
  it('User B cannot read User A’s private notification', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notifications', 'notif-1'), {
        recipientId: USER_A,
        actorId: USER_B,
        type: 'friend-request',
        read: false,
      })
    })
    const b = testEnv.authenticatedContext(USER_B)
    await assertFails(getDoc(doc(b.firestore(), 'notifications', 'notif-1')))

    const a = testEnv.authenticatedContext(USER_A)
    await assertSucceeds(getDoc(doc(a.firestore(), 'notifications', 'notif-1')))
  })

  it('only the recipient can mark it read, and only that field', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notifications', 'notif-1'), {
        recipientId: USER_A,
        actorId: USER_B,
        type: 'friend-request',
        read: false,
      })
    })
    const a = testEnv.authenticatedContext(USER_A)
    await assertSucceeds(updateDoc(doc(a.firestore(), 'notifications', 'notif-1'), { read: true }))
    await assertFails(updateDoc(doc(a.firestore(), 'notifications', 'notif-1'), { actorId: USER_A }))
  })
})

// --- sharedMoments/{id} — owner controls the story; participants see it only
// per the sharing rules, and can only touch their own acceptance. -----------
describe('sharedMoments/{id}', () => {
  it('is readable by the owner and a tagged participant, not an outsider', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sharedMoments', 'moment-1'), {
        ownerId: USER_A,
        participantIds: [USER_B],
        acceptedParticipantIds: [],
        bottleName: 'Eagle Rare',
      })
    })
    const owner = testEnv.authenticatedContext(USER_A)
    const participant = testEnv.authenticatedContext(USER_B)
    const outsider = testEnv.authenticatedContext(OUTSIDER)
    await assertSucceeds(getDoc(doc(owner.firestore(), 'sharedMoments', 'moment-1')))
    await assertSucceeds(getDoc(doc(participant.firestore(), 'sharedMoments', 'moment-1')))
    await assertFails(getDoc(doc(outsider.firestore(), 'sharedMoments', 'moment-1')))
  })

  it('a participant can only touch their own acceptance, never rewrite the story', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sharedMoments', 'moment-1'), {
        ownerId: USER_A,
        participantIds: [USER_B],
        acceptedParticipantIds: [],
        bottleName: 'Eagle Rare',
      })
    })
    const participant = testEnv.authenticatedContext(USER_B)
    await assertSucceeds(
      updateDoc(doc(participant.firestore(), 'sharedMoments', 'moment-1'), { acceptedParticipantIds: [USER_B] }),
    )
    await assertFails(updateDoc(doc(participant.firestore(), 'sharedMoments', 'moment-1'), { bottleName: 'Hijacked' }))
  })

  it('only the owner can delete their shared moment', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sharedMoments', 'moment-1'), {
        ownerId: USER_A,
        participantIds: [USER_B],
        acceptedParticipantIds: [],
        bottleName: 'Eagle Rare',
      })
    })
    const participant = testEnv.authenticatedContext(USER_B)
    await assertFails(deleteDoc(doc(participant.firestore(), 'sharedMoments', 'moment-1')))

    const owner = testEnv.authenticatedContext(USER_A)
    await assertSucceeds(deleteDoc(doc(owner.firestore(), 'sharedMoments', 'moment-1')))
  })
})

// --- sharedCollections/{ownerUid} — always owner-write; read gated on the
// owner's own privacy settings, not a blanket allow. -------------------------
describe('sharedCollections/{ownerUid}', () => {
  it('is not readable by a stranger when the owner’s privacy is private', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'profiles', USER_A), {
        username: 'kevin',
        privacy: { collectionVisibility: 'private', wishListVisibility: 'private' },
      })
      await setDoc(doc(context.firestore(), 'sharedCollections', USER_A), { bottles: [] })
    })
    const outsider = testEnv.authenticatedContext(OUTSIDER)
    await assertFails(getDoc(doc(outsider.firestore(), 'sharedCollections', USER_A)))
  })

  it('is readable by any signed-in user once the owner opts into fip-users visibility', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'profiles', USER_A), {
        username: 'kevin',
        privacy: { collectionVisibility: 'fip-users', wishListVisibility: 'private' },
      })
      await setDoc(doc(context.firestore(), 'sharedCollections', USER_A), { bottles: [] })
    })
    const outsider = testEnv.authenticatedContext(OUTSIDER)
    await assertSucceeds(getDoc(doc(outsider.firestore(), 'sharedCollections', USER_A)))
  })

  it('only the owner can write it, regardless of visibility settings', async () => {
    const b = testEnv.authenticatedContext(USER_B)
    await assertFails(setDoc(doc(b.firestore(), 'sharedCollections', USER_A), { bottles: [] }))
  })
})

// --- Baseline: default-deny for anything not explicitly matched above. -----
describe('default deny', () => {
  it('denies read/write on a collection with no matching rule', async () => {
    const a = testEnv.authenticatedContext(USER_A)
    await assertFails(getDoc(doc(a.firestore(), 'somethingUnmapped', 'doc-1')))
    await assertFails(setDoc(doc(a.firestore(), 'somethingUnmapped', 'doc-1'), { anything: true }))
  })
})

// Sanity check that this file actually exercises the real rules file, not a
// stale copy — fails loudly if firestore.rules moves or is renamed.
describe('rules file sanity', () => {
  it('loaded a non-empty rules file', () => {
    expect(readFileSync(RULES_PATH, 'utf8').length).toBeGreaterThan(100)
  })
})
