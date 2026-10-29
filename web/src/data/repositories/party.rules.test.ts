/// <reference types="node" />
// Blind Room Party Mode read boundaries (firestore.rules). Every party
// write goes through the partyAction Cloud Function, so the rules here are
// all about who can READ what — and that no client can write at all.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules')

let testEnv: RulesTestEnvironment

const HOST = 'party-host'
const GUEST = 'party-guest'
const OTHER_GUEST = 'party-guest-2'
const REVOKED = 'party-revoked'
const TV = 'party-tv'
const OUTSIDER = 'party-outsider'
const COHOST = 'party-cohost'
const PARTY = 'party-1'
const OTHER_PARTY = 'party-2'
const LEGACY_PARTY = 'party-legacy'

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fip-party-rules-test',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8') },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    for (const id of [PARTY, OTHER_PARTY]) {
      // No admin uids on the party document: admins are recognised by
      // their protected records below.
      await setDoc(doc(db, 'parties', id), {
        id,
        hostName: 'Kevin',
        name: 'Bourbon Night',
        status: 'live',
        categories: [{ id: 'c1', name: 'Wheated', state: 'voting_open', sampleLabels: ['A', 'B'] }],
      })
    }
    await setDoc(doc(db, 'parties', PARTY, 'admins', HOST), { uid: HOST, role: 'host', name: 'Kevin', addedAt: 1 })
    await setDoc(doc(db, 'parties', PARTY, 'admins', COHOST), { uid: COHOST, role: 'cohost', name: 'Pat', addedAt: 2 })
    await setDoc(doc(db, 'parties', OTHER_PARTY, 'admins', 'someone-else'), { uid: 'someone-else', role: 'host', name: 'Other', addedAt: 1 })
    // A party created before admin records existed, not migrated yet.
    await setDoc(doc(db, 'parties', LEGACY_PARTY), {
      id: LEGACY_PARTY,
      hostUid: HOST,
      coHostUids: [COHOST],
      hostName: 'Kevin',
      name: 'Old Night',
      status: 'completed',
      categories: [],
    })
    await setDoc(doc(db, 'parties', LEGACY_PARTY, 'guests', GUEST), { uid: GUEST, nickname: 'Kev', revoked: false, participantKey: 'g_7' })
    await setDoc(doc(db, 'partySecrets', PARTY), {
      partyId: PARTY,
      hostUid: HOST,
      categories: { c1: { samples: [{ label: 'A', bottle: { name: 'Weller' } }] } },
    })
    await setDoc(doc(db, 'parties', PARTY, 'guests', GUEST), { uid: GUEST, nickname: 'Kev', revoked: false, participantKey: 'g_1' })
    await setDoc(doc(db, 'parties', PARTY, 'guests', OTHER_GUEST), { uid: OTHER_GUEST, nickname: 'Sam', revoked: false, participantKey: 'g_2' })
    await setDoc(doc(db, 'parties', PARTY, 'guests', REVOKED), { uid: REVOKED, nickname: 'Troll', revoked: true, participantKey: 'g_3' })
    await setDoc(doc(db, 'parties', OTHER_PARTY, 'guests', GUEST), { uid: GUEST, nickname: 'Kev', revoked: false, participantKey: 'g_9' })
    await setDoc(doc(db, 'parties', PARTY, 'displays', TV), { uid: TV, expiresAt: Date.now() + 3600_000 })
    await setDoc(doc(db, 'parties', PARTY, 'displays', 'stale-tv'), { uid: 'stale-tv', expiresAt: Date.now() - 1000 })
    await setDoc(doc(db, 'parties', PARTY, 'ballots', 'c1__g_1'), { ownerUid: GUEST, categoryId: 'c1', scores: { A: { overall: 7, notes: 'private' } } })
    await setDoc(doc(db, 'parties', PARTY, 'ballots', 'c1__g_2'), { ownerUid: OTHER_GUEST, categoryId: 'c1', scores: { A: { overall: 5 } } })
    await setDoc(doc(db, 'parties', PARTY, 'ballots', 'c1__p_1'), { ownerUid: HOST, source: 'paper', categoryId: 'c1', scores: { A: { overall: 6 } } })
    await setDoc(doc(db, 'parties', PARTY, 'results', 'c1'), { categoryId: 'c1', samples: [] })
    await setDoc(doc(db, 'parties', PARTY, 'audit', 'e1'), { type: 'party-created' })
    await setDoc(doc(db, 'parties', PARTY, 'roster', 'host'), { id: 'host', name: 'Kevin', role: 'host', tasting: true, joinedAt: 1, progress: {} })
    await setDoc(doc(db, 'parties', PARTY, 'roster', 'g_1'), { id: 'g_1', name: 'Kev', role: 'guest', tasting: true, joinedAt: 2, progress: {} })
    await setDoc(doc(db, 'parties', OTHER_PARTY, 'roster', 'g_9'), { id: 'g_9', name: 'Kev', role: 'guest', tasting: true, joinedAt: 2, progress: {} })
    await setDoc(doc(db, 'partyCodes', 'OAK742'), { partyId: PARTY })
    await setDoc(doc(db, 'partyGuestKeys', 'hash'), { partyId: PARTY, uid: GUEST })
  })
})

function as(uid: string) {
  return testEnv.authenticatedContext(uid).firestore()
}

describe('party documents', () => {
  it('are readable by the host, joined guests and active displays only', async () => {
    await assertSucceeds(getDoc(doc(as(HOST), 'parties', PARTY)))
    await assertSucceeds(getDoc(doc(as(GUEST), 'parties', PARTY)))
    await assertSucceeds(getDoc(doc(as(TV), 'parties', PARTY)))
    await assertFails(getDoc(doc(as(OUTSIDER), 'parties', PARTY)))
    await assertFails(getDoc(doc(as(REVOKED), 'parties', PARTY)))
    await assertFails(getDoc(doc(as('stale-tv'), 'parties', PARTY)))
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'parties', PARTY)))
  })

  it('never cross party boundaries', async () => {
    await assertFails(getDoc(doc(as(TV), 'parties', OTHER_PARTY)))
    await assertFails(getDoc(doc(as(HOST), 'parties', OTHER_PARTY)))
    await assertSucceeds(getDoc(doc(as(GUEST), 'parties', OTHER_PARTY)))
    await assertFails(getDoc(doc(as(OTHER_GUEST), 'parties', OTHER_PARTY, 'results', 'c1')))
  })

  it('cannot be written by any client, host included', async () => {
    await assertFails(updateDoc(doc(as(HOST), 'parties', PARTY), { status: 'completed' }))
    await assertFails(setDoc(doc(as(HOST), 'parties', 'new-party'), { hostUid: HOST }))
    await assertFails(deleteDoc(doc(as(HOST), 'parties', PARTY)))
    await assertFails(updateDoc(doc(as(GUEST), 'parties', PARTY), { name: 'x' }))
  })

  it('lets hosts and co-hosts list the parties they run, through their own admin records', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(as(HOST), 'admins'), where('uid', '==', HOST))))
    await assertSucceeds(getDocs(query(collectionGroup(as(COHOST), 'admins'), where('uid', '==', COHOST))))
    await assertFails(getDocs(query(collectionGroup(as(OUTSIDER), 'admins'), where('uid', '==', HOST))))
    await assertFails(getDocs(query(collectionGroup(as(GUEST), 'admins'))))
  })
})

describe('unrevealed bottle mapping', () => {
  it('is readable by no client at all — not even the host or a co-host — and never writable', async () => {
    // Admins get it only from the getBottleKey callable, which confirms and logs each view.
    await assertFails(getDoc(doc(as(HOST), 'partySecrets', PARTY)))
    await assertFails(getDoc(doc(as(COHOST), 'partySecrets', PARTY)))
    await assertFails(getDoc(doc(as(GUEST), 'partySecrets', PARTY)))
    await assertFails(getDoc(doc(as(TV), 'partySecrets', PARTY)))
    await assertFails(getDoc(doc(as(OUTSIDER), 'partySecrets', PARTY)))
    await assertFails(setDoc(doc(as(HOST), 'partySecrets', PARTY), { hostUid: HOST, categories: {} }))
  })

  it('co-host invites are server-only', async () => {
    await assertFails(getDoc(doc(as(HOST), 'partyCoHostInvites', 'hash')))
    await assertFails(setDoc(doc(as(OUTSIDER), 'partyCoHostInvites', 'hash'), { partyId: PARTY }))
  })

  it('server-only lookup collections are closed to every client', async () => {
    await assertFails(getDoc(doc(as(GUEST), 'partyCodes', 'OAK742')))
    await assertFails(getDoc(doc(as(HOST), 'partyGuestKeys', 'hash')))
    await assertFails(setDoc(doc(as(GUEST), 'partyCodes', 'NEWONE'), { partyId: PARTY }))
    await assertFails(setDoc(doc(as(GUEST), 'partyClaims', 'x'), { anonUid: GUEST }))
  })
})

describe('co-hosts', () => {
  it('read what the host reads to run the event — party, roster, results, audit, displays', async () => {
    await assertSucceeds(getDoc(doc(as(COHOST), 'parties', PARTY)))
    await assertSucceeds(getDocs(collection(as(COHOST), 'parties', PARTY, 'guests')))
    await assertSucceeds(getDoc(doc(as(COHOST), 'parties', PARTY, 'results', 'c1')))
    await assertSucceeds(getDocs(collection(as(COHOST), 'parties', PARTY, 'audit')))
    await assertSucceeds(getDoc(doc(as(COHOST), 'parties', PARTY, 'displays', TV)))
  })

  it('never read anyone’s ballot, and only for their own party', async () => {
    await assertFails(getDoc(doc(as(COHOST), 'parties', PARTY, 'ballots', 'c1__g_1')))
    await assertFails(getDoc(doc(as(COHOST), 'parties', PARTY, 'ballots', 'c1__p_1')))
    await assertFails(getDoc(doc(as(COHOST), 'parties', OTHER_PARTY)))
    await assertFails(getDocs(collection(as(COHOST), 'parties', OTHER_PARTY, 'audit')))
  })

  it('cannot write party data directly', async () => {
    await assertFails(updateDoc(doc(as(COHOST), 'parties', PARTY), { name: 'Mine now' }))
    await assertFails(setDoc(doc(as(COHOST), 'parties', PARTY, 'admins', OUTSIDER), { uid: OUTSIDER, role: 'cohost', name: 'Friend' }))
  })
})

describe('guests and ballots', () => {
  it('guest records are visible to the host and the guest themselves only', async () => {
    await assertSucceeds(getDoc(doc(as(GUEST), 'parties', PARTY, 'guests', GUEST)))
    await assertSucceeds(getDocs(collection(as(HOST), 'parties', PARTY, 'guests')))
    await assertFails(getDoc(doc(as(GUEST), 'parties', PARTY, 'guests', OTHER_GUEST)))
    await assertFails(getDocs(collection(as(GUEST), 'parties', PARTY, 'guests')))
    await assertFails(setDoc(doc(as(OUTSIDER), 'parties', PARTY, 'guests', OUTSIDER), { uid: OUTSIDER, nickname: 'Me', revoked: false }))
  })

  it('a guest can query their own guest records across parties', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(as(GUEST), 'guests'), where('uid', '==', GUEST))))
    await assertFails(getDocs(query(collectionGroup(as(GUEST), 'guests'), where('uid', '==', OTHER_GUEST))))
  })

  it('ballots are readable only by their owner — not other guests, not the host', async () => {
    await assertSucceeds(getDoc(doc(as(GUEST), 'parties', PARTY, 'ballots', 'c1__g_1')))
    await assertFails(getDoc(doc(as(OTHER_GUEST), 'parties', PARTY, 'ballots', 'c1__g_1')))
    await assertFails(getDoc(doc(as(HOST), 'parties', PARTY, 'ballots', 'c1__g_1')))
    await assertSucceeds(getDoc(doc(as(HOST), 'parties', PARTY, 'ballots', 'c1__p_1')))
    await assertSucceeds(getDocs(query(collection(as(GUEST), 'parties', PARTY, 'ballots'), where('ownerUid', '==', GUEST))))
    await assertFails(getDocs(collection(as(GUEST), 'parties', PARTY, 'ballots')))
  })

  it('a host who is tasting too reads their own ballot like any guest, and no one else can', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'parties', PARTY, 'guests', HOST), { uid: HOST, nickname: 'Host', revoked: false, participantKey: 'h_1', isHost: true })
      await setDoc(doc(db, 'parties', PARTY, 'ballots', 'c1__h_1'), { ownerUid: HOST, source: 'digital', categoryId: 'c1', scores: { A: { overall: 9 } } })
    })
    await assertSucceeds(getDocs(query(collection(as(HOST), 'parties', PARTY, 'ballots'), where('ownerUid', '==', HOST))))
    await assertFails(getDoc(doc(as(GUEST), 'parties', PARTY, 'ballots', 'c1__h_1')))
    await assertFails(getDoc(doc(as(GUEST), 'parties', PARTY, 'guests', HOST)))
    // Being a taster never opens the host's guest record to writes either.
    await assertFails(updateDoc(doc(as(HOST), 'parties', PARTY, 'guests', HOST), { revoked: true }))
  })

  it('ballots cannot be written directly, so votes always pass server validation', async () => {
    await assertFails(setDoc(doc(as(GUEST), 'parties', PARTY, 'ballots', 'c1__g_1'), { ownerUid: GUEST, scores: { A: { overall: 10 } } }))
    await assertFails(updateDoc(doc(as(GUEST), 'parties', PARTY, 'ballots', 'c1__g_1'), { scores: {} }))
    await assertFails(setDoc(doc(as(HOST), 'parties', PARTY, 'ballots', 'c1__p_2'), { ownerUid: HOST, source: 'paper' }))
  })
})

describe('results, audit and displays', () => {
  it('results are readable by members and displays, never outsiders or revoked guests', async () => {
    await assertSucceeds(getDoc(doc(as(GUEST), 'parties', PARTY, 'results', 'c1')))
    await assertSucceeds(getDoc(doc(as(TV), 'parties', PARTY, 'results', 'c1')))
    await assertSucceeds(getDoc(doc(as(HOST), 'parties', PARTY, 'results', 'c1')))
    await assertFails(getDoc(doc(as(OUTSIDER), 'parties', PARTY, 'results', 'c1')))
    await assertFails(getDoc(doc(as(REVOKED), 'parties', PARTY, 'results', 'c1')))
    await assertFails(setDoc(doc(as(HOST), 'parties', PARTY, 'results', 'c2'), { samples: [] }))
  })

  it('the audit log is host-only', async () => {
    await assertSucceeds(getDocs(collection(as(HOST), 'parties', PARTY, 'audit')))
    await assertFails(getDocs(collection(as(GUEST), 'parties', PARTY, 'audit')))
    await assertFails(getDocs(collection(as(TV), 'parties', PARTY, 'audit')))
  })

  it('a display cannot grant itself access', async () => {
    await assertFails(setDoc(doc(as(OUTSIDER), 'parties', PARTY, 'displays', OUTSIDER), { uid: OUTSIDER, expiresAt: Date.now() + 1e9 }))
  })
})

describe('saved categories and setups', () => {
  it('are owner-only and shape-checked', async () => {
    await assertSucceeds(setDoc(doc(as(HOST), 'users', HOST, 'partyCategories', 'mine'), { name: 'Kentucky Owl Night', description: '' }))
    await assertFails(setDoc(doc(as(HOST), 'users', HOST, 'partyCategories', 'bad'), { name: '' }))
    await assertFails(setDoc(doc(as(HOST), 'users', HOST, 'partyCategories', 'long'), { name: 'x'.repeat(81) }))
    await assertFails(getDoc(doc(as(GUEST), 'users', HOST, 'partyCategories', 'mine')))
    await assertFails(setDoc(doc(as(GUEST), 'users', HOST, 'partyCategories', 'x'), { name: 'Sneaky' }))
    await assertSucceeds(setDoc(doc(as(HOST), 'users', HOST, 'partyTemplates', 't1'), { name: 'Usual', categories: [] }))
    await assertFails(getDocs(collection(as(GUEST), 'users', HOST, 'partyTemplates')))
  })
})

describe("Who's Tasting roster", () => {
  it('is readable by every member of the party, including anonymous QR-code guests', async () => {
    await assertSucceeds(getDocs(collection(as(HOST), 'parties', PARTY, 'roster')))
    await assertSucceeds(getDocs(collection(as(COHOST), 'parties', PARTY, 'roster')))
    await assertSucceeds(getDocs(collection(as(GUEST), 'parties', PARTY, 'roster')))
    await assertSucceeds(getDocs(collection(as(OTHER_GUEST), 'parties', PARTY, 'roster')))
    const anonymous = testEnv.authenticatedContext(GUEST, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
    await assertSucceeds(getDoc(doc(anonymous, 'parties', PARTY, 'roster', 'host')))
  })

  it('is closed to outsiders, removed guests, TV displays and the signed-out', async () => {
    await assertFails(getDocs(collection(as(OUTSIDER), 'parties', PARTY, 'roster')))
    await assertFails(getDocs(collection(as(REVOKED), 'parties', PARTY, 'roster')))
    await assertFails(getDocs(collection(as(TV), 'parties', PARTY, 'roster')))
    await assertFails(getDocs(collection(testEnv.unauthenticatedContext().firestore(), 'parties', PARTY, 'roster')))
  })

  it('never crosses into another party', async () => {
    await assertFails(getDocs(collection(as(OTHER_GUEST), 'parties', OTHER_PARTY, 'roster')))
    await assertFails(getDocs(collection(as(COHOST), 'parties', OTHER_PARTY, 'roster')))
    await assertFails(getDocs(query(collectionGroup(as(GUEST), 'roster'))))
  })

  it('cannot be written by anyone, host included', async () => {
    await assertFails(setDoc(doc(as(HOST), 'parties', PARTY, 'roster', 'fake'), { name: 'Ghost', role: 'guest', tasting: true }))
    await assertFails(updateDoc(doc(as(GUEST), 'parties', PARTY, 'roster', 'g_1'), { name: 'Impostor', role: 'host' }))
    await assertFails(deleteDoc(doc(as(COHOST), 'parties', PARTY, 'roster', 'g_1')))
  })

  it('leaves the private guest records closed to other guests', async () => {
    await assertFails(getDocs(collection(as(GUEST), 'parties', PARTY, 'guests')))
    await assertFails(getDoc(doc(as(GUEST), 'parties', PARTY, 'guests', OTHER_GUEST)))
  })
})

describe('admin identities', () => {
  it('admin records are readable by the party’s admins only — never by guests, displays or outsiders', async () => {
    await assertSucceeds(getDoc(doc(as(HOST), 'parties', PARTY, 'admins', COHOST)))
    await assertSucceeds(getDocs(collection(as(COHOST), 'parties', PARTY, 'admins')))
    await assertFails(getDocs(collection(as(GUEST), 'parties', PARTY, 'admins')))
    await assertFails(getDoc(doc(as(GUEST), 'parties', PARTY, 'admins', HOST)))
    const anonymous = testEnv.authenticatedContext(OTHER_GUEST, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
    await assertFails(getDoc(doc(anonymous, 'parties', PARTY, 'admins', HOST)))
    await assertFails(getDocs(collection(as(TV), 'parties', PARTY, 'admins')))
    await assertFails(getDocs(collection(as(OUTSIDER), 'parties', PARTY, 'admins')))
    await assertFails(getDocs(collection(as(HOST), 'parties', OTHER_PARTY, 'admins')))
  })

  it('the party document guests read carries no host or co-host uid', async () => {
    const snap = await assertSucceeds(getDoc(doc(as(GUEST), 'parties', PARTY)))
    const json = JSON.stringify(snap.data())
    expect(json).not.toContain(HOST)
    expect(json).not.toContain(COHOST)
  })

  it('no one can make themselves an admin', async () => {
    await assertFails(setDoc(doc(as(GUEST), 'parties', PARTY, 'admins', GUEST), { uid: GUEST, role: 'host', name: 'Me' }))
    await assertFails(setDoc(doc(as(OUTSIDER), 'parties', PARTY, 'admins', OUTSIDER), { uid: OUTSIDER, role: 'cohost', name: 'Me' }))
    await assertFails(updateDoc(doc(as(COHOST), 'parties', PARTY, 'admins', COHOST), { role: 'host' }))
    await assertFails(deleteDoc(doc(as(HOST), 'parties', PARTY, 'admins', COHOST)))
    await assertFails(updateDoc(doc(as(GUEST), 'parties', PARTY), { hostUid: GUEST }))
  })

  it('guests gain no admin access: no guest records, audit log or bottle mapping', async () => {
    await assertFails(getDocs(collection(as(GUEST), 'parties', PARTY, 'guests')))
    await assertFails(getDocs(collection(as(GUEST), 'parties', PARTY, 'audit')))
    await assertFails(getDocs(collection(as(GUEST), 'parties', PARTY, 'displays')))
    await assertFails(getDoc(doc(as(GUEST), 'partySecrets', PARTY)))
  })

  it('keeps an un-migrated older party working for its host, co-host and guests', async () => {
    await assertSucceeds(getDoc(doc(as(HOST), 'parties', LEGACY_PARTY)))
    await assertSucceeds(getDoc(doc(as(COHOST), 'parties', LEGACY_PARTY)))
    await assertSucceeds(getDocs(collection(as(HOST), 'parties', LEGACY_PARTY, 'guests')))
    await assertSucceeds(getDoc(doc(as(GUEST), 'parties', LEGACY_PARTY)))
    await assertFails(getDoc(doc(as(OUTSIDER), 'parties', LEGACY_PARTY)))
    await assertFails(getDocs(collection(as(GUEST), 'parties', LEGACY_PARTY, 'guests')))
  })
})

describe('dual experience guided views', () => {
  const DUAL = 'party-dual'
  const G_GUIDED = 'dual-guided'
  const G_BLIND = 'dual-blind'
  const G_NOGROUP = 'dual-nogroup'
  const G_REVOKED_GUIDED = 'dual-revoked'
  const DUAL_HOST = 'dual-host'
  const DUAL_COHOST = 'dual-cohost'

  async function seed(hostGroup: 'guided' | 'blind' | null) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'parties', DUAL), { id: DUAL, format: 'dual', name: 'Dual Night', status: 'live', categories: [{ id: 'c1', sampleLabels: ['A', 'B', 'C'] }] })
      await setDoc(doc(db, 'parties', DUAL, 'admins', DUAL_HOST), { uid: DUAL_HOST, role: 'host', name: 'Kevin', addedAt: 1 })
      await setDoc(doc(db, 'parties', DUAL, 'admins', DUAL_COHOST), { uid: DUAL_COHOST, role: 'cohost', name: 'Pat', addedAt: 2 })
      if (hostGroup) await setDoc(doc(db, 'parties', DUAL, 'guests', DUAL_HOST), { uid: DUAL_HOST, isHost: true, revoked: false, participantKey: 'h_1', group: hostGroup })
      await setDoc(doc(db, 'parties', DUAL, 'guests', G_GUIDED), { uid: G_GUIDED, revoked: false, participantKey: 'g_1', group: 'guided' })
      await setDoc(doc(db, 'parties', DUAL, 'guests', G_BLIND), { uid: G_BLIND, revoked: false, participantKey: 'g_2', group: 'blind' })
      await setDoc(doc(db, 'parties', DUAL, 'guests', G_NOGROUP), { uid: G_NOGROUP, revoked: false, participantKey: 'g_3' })
      await setDoc(doc(db, 'parties', DUAL, 'guests', G_REVOKED_GUIDED), { uid: G_REVOKED_GUIDED, revoked: true, participantKey: 'g_4', group: 'guided' })
      await setDoc(doc(db, 'parties', DUAL, 'displays', TV), { uid: TV, expiresAt: Date.now() + 3600_000 })
      await setDoc(doc(db, 'parties', DUAL, 'guided', 'c1'), { categoryId: 'c1', bottles: { A: { name: 'Weller Antique 107' } } })
      await setDoc(doc(db, 'parties', DUAL, 'roster', 'g_2'), { id: 'g_2', name: 'Richy', role: 'guest', tasting: true, joinedAt: 2, progress: {}, group: 'blind' })
    })
  }

  it('are readable by guided guests and by admins who are not tasting blind', async () => {
    await seed('guided')
    await assertSucceeds(getDoc(doc(as(G_GUIDED), 'parties', DUAL, 'guided', 'c1')))
    await assertSucceeds(getDocs(collection(as(G_GUIDED), 'parties', DUAL, 'guided')))
    await assertSucceeds(getDoc(doc(as(DUAL_HOST), 'parties', DUAL, 'guided', 'c1')))
    await assertSucceeds(getDoc(doc(as(DUAL_COHOST), 'parties', DUAL, 'guided', 'c1')))
  })

  it('are never readable by blind tasters, tasters without an explicit group, revoked guests, displays or outsiders', async () => {
    await seed('guided')
    await assertFails(getDoc(doc(as(G_BLIND), 'parties', DUAL, 'guided', 'c1')))
    await assertFails(getDocs(collection(as(G_BLIND), 'parties', DUAL, 'guided')))
    await assertFails(getDoc(doc(as(G_NOGROUP), 'parties', DUAL, 'guided', 'c1')))
    await assertFails(getDoc(doc(as(G_REVOKED_GUIDED), 'parties', DUAL, 'guided', 'c1')))
    await assertFails(getDoc(doc(as(TV), 'parties', DUAL, 'guided', 'c1')))
    await assertFails(getDoc(doc(as(OUTSIDER), 'parties', DUAL, 'guided', 'c1')))
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'parties', DUAL, 'guided', 'c1')))
  })

  it('keep a host who tastes blind on the logged bottle key instead', async () => {
    await seed('blind')
    await assertFails(getDoc(doc(as(DUAL_HOST), 'parties', DUAL, 'guided', 'c1')))
    // The co-host pouring for them still can.
    await assertSucceeds(getDoc(doc(as(DUAL_COHOST), 'parties', DUAL, 'guided', 'c1')))
    // A host who isn't tasting at all keeps admin access.
    await seed(null)
    await testEnv.withSecurityRulesDisabled((context) => deleteDoc(doc(context.firestore(), 'parties', DUAL, 'guests', DUAL_HOST)))
    await assertSucceeds(getDoc(doc(as(DUAL_HOST), 'parties', DUAL, 'guided', 'c1')))
  })

  it('cannot be written by any client', async () => {
    await seed('guided')
    await assertFails(setDoc(doc(as(DUAL_HOST), 'parties', DUAL, 'guided', 'c1'), { bottles: {} }))
    await assertFails(setDoc(doc(as(G_GUIDED), 'parties', DUAL, 'guided', 'c2'), { bottles: {} }))
    // Nor can anyone move themselves into the guided group.
    await assertFails(updateDoc(doc(as(G_BLIND), 'parties', DUAL, 'guests', G_BLIND), { group: 'guided' }))
  })

  it('leave the shared roster readable by both groups, showing only the group name', async () => {
    await seed('guided')
    const blindView = await getDoc(doc(as(G_GUIDED), 'parties', DUAL, 'roster', 'g_2'))
    expect(blindView.data()).toMatchObject({ name: 'Richy', group: 'blind' })
    await assertSucceeds(getDocs(collection(as(G_BLIND), 'parties', DUAL, 'roster')))
  })
})
